const BASE = 'https://api.pipedrive.com/v1';
export const PIPELINE_VENDAS_SPOT = 28;
const EMPREENDIMENTO_FIELD_KEY = '6d565fd4fce66c16da078f520a685fa2fa038272';
const LEADGEN_FIELD_KEY = '5c2b5585058df45ab36ce6a66eff9dd3dafc63c9';

export async function pipedriveGet(path: string, token: string) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}/${path}${sep}api_token=${token}`);
  if (!res.ok) throw new Error(`Pipedrive ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data;
}

export async function pipedrivePost(path: string, token: string, body: object) {
  const res = await fetch(`${BASE}/${path}?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Pipedrive POST ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data;
}

export async function pipedrivePatch(path: string, token: string, body: object) {
  const res = await fetch(`${BASE}/${path}?api_token=${token}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Pipedrive PATCH ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data;
}

export function extractLeadgenId(deal: Record<string, unknown>, person: Record<string, unknown> | null): string | null {
  if (deal?.[LEADGEN_FIELD_KEY]) {
    const val = String(deal[LEADGEN_FIELD_KEY]).trim();
    if (val) return val;
  }
  for (const [key, value] of Object.entries(deal)) {
    if (key.length < 30) continue;
    if (typeof value === 'string' && /^\d{10,20}$/.test(value.trim())) return value.trim();
  }
  if (person) {
    for (const [key, value] of Object.entries(person)) {
      if (key.length < 30) continue;
      if (typeof value === 'string' && /^\d{10,20}$/.test(value.trim())) return value.trim();
    }
  }
  return null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

export async function fetchNektData(leadgenId: string, nektKey: string) {
  const sql = `SELECT * FROM "nekt_silver"."facebook_leads_szi_unidos_expandido" WHERE id = '${leadgenId.replace(/'/g, "''")}' LIMIT 1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch('https://api.nekt.ai/api/v1/sql-query/', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': nektKey },
      body: JSON.stringify({ sql, mode: 'csv' }),
    });
    if (!res.ok) return null;
    const result = await res.json();
    if (result.state !== 'SUCCEEDED' || !result.presigned_urls?.length) return null;
    const csvRes = await fetch(result.presigned_urls[0]);
    if (!csvRes.ok) return null;
    const csvText = await csvRes.text();
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return null;
    const headers = parseCSVLine(lines[0]);
    const values = parseCSVLine(lines[1]);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim().toLowerCase()] = values[i]?.trim() || ''; });
    return {
      budget_declarado: row['qual_o_valor_total_que_voce_pretende_investir_dentro_de_54_meses_'] || null,
      objetivo: row['voce_procura_investimento_ou_para_uso_proprio_'] || null,
      forma_pagamento: row['qual_a_forma_de_pagamento_'] || null,
      empreendimento: row['empreendimento'] || null,
      regiao: row['regiao_de_atuacao'] || null,
      corretor: row['voce_e_corretor_de_imoveis_'] || null,
    };
  } catch { return null; }
  finally { clearTimeout(timer); }
}

export function extractFromMiaNotes(notes: Array<{ content: string; user?: string }>) {
  const miaNotes = notes.filter(n => {
    const c = (n.content || '').toLowerCase();
    return c.includes('mia') || c.includes('mariana') || (n.user || '').toLowerCase().includes('morada') || c.includes('relato enviado');
  });
  let budget: string | null = null;
  let objetivo: string | null = null;
  let formaPagamento: string | null = null;
  for (const note of miaNotes) {
    const content = (note.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    if (!budget) {
      const m = content.match(/(?:investir|budget|valor|orçamento)[^.!?]{0,60}?(R\$\s*[\d.,]+(?:\s*(?:a|e|até)\s*R\$\s*[\d.,]+)?(?:[^.!?\n]{0,60}(?:meses?|anos?))?)/i);
      if (m) budget = m[1].trim();
    }
    if (!objetivo) {
      const m = content.match(/(?:busca|objetivo|interesse|investimento)[^:\n]{0,30}(?:para\s+)?(renda\s+(?:com\s+)?aluguel|valoriza[çc][aã]o|uso\s+pr[oó]prio|investimento|renda\s+passiva)/i);
      if (m) objetivo = m[1].trim();
    }
    if (!formaPagamento) {
      const m = content.match(/(?:forma\s+de\s+pagamento|pagamento\s+(?:via|por)|pagar)[^:\n]{0,20}(pix|boleto|financiamento|parcelado|à vista|a vista)/i);
      if (m) formaPagamento = m[1].trim();
    }
  }
  return { budget, objetivo, formaPagamento };
}

export async function getFullDealData(dealId: string, token: string) {
  const deal = await pipedriveGet(`deals/${dealId}`, token);
  if (!deal) throw new Error('Deal não encontrado');

  const personId = deal.person_id?.value || deal.person_id;
  const [person, activitiesRaw, notesRaw] = await Promise.all([
    personId ? pipedriveGet(`persons/${personId}`, token).catch(() => null) : null,
    pipedriveGet(`deals/${dealId}/activities`, token).catch(() => []),
    pipedriveGet(`notes?deal_id=${dealId}`, token).catch(() => []),
  ]);

  const activities = (activitiesRaw || []).slice(0, 15).map((a: Record<string, unknown>) => ({
    type: a.type, subject: a.subject, due_date: a.due_date,
    note: (a.note as string || a.public_description as string || '').substring(0, 300), done: a.done,
  }));
  const notes = (notesRaw || []).slice(0, 15).map((n: Record<string, unknown>) => ({
    content: (n.content as string || '').substring(0, 600),
    add_time: n.add_time, user: (n.user as { name?: string })?.name || '',
  }));

  const miaData = extractFromMiaNotes(notes);
  const dealValue = deal.value || deal.weighted_value || 0;
  let budget = 'Não informado';
  if (dealValue >= 1000000) budget = `R$ ${(dealValue / 1000000).toFixed(1).replace('.', ',')}M`;
  else if (dealValue >= 1000) budget = `R$ ${(dealValue / 1000).toFixed(0)}K`;
  else if (dealValue > 0) budget = `R$ ${dealValue}`;

  return {
    deal_id: String(dealId),
    pipeline_id: deal.pipeline_id,
    stage_name: deal.stage_name || '',
    title: deal.title || '',
    status: deal.status || '',
    person_name: (person as { name?: string })?.name || deal.person_name || 'Lead sem nome',
    person_email: (person as { email?: Array<{ value: string }> })?.email?.[0]?.value || null,
    person_phone: (person as { phone?: Array<{ value: string }> })?.phone?.[0]?.value || null,
    owner_name: deal.owner_name || (deal.user_id as { name?: string })?.name || '',
    budget,
    budget_value: dealValue,
    mia_objetivo: miaData.objetivo,
    mia_budget: miaData.budget,
    mia_forma_pagamento: miaData.formaPagamento,
    activities,
    notes,
    add_time: deal.add_time || '',
    update_time: deal.update_time || '',
    empreendimento_field_key: EMPREENDIMENTO_FIELD_KEY,
    raw_empreendimento_id: deal[EMPREENDIMENTO_FIELD_KEY] || null,
    leadgen_id: extractLeadgenId(deal as Record<string, unknown>, person as Record<string, unknown> | null),
  };
}

export async function checkWonHistory(personEmail: string | null, personPhone: string | null, token: string) {
  if (!personEmail && !personPhone) return [];
  const wonDeals: Array<{ id: number; title: string; pipeline_id: number; stage_name: string; value: number; won_time: string }> = [];
  try {
    const all = await pipedriveGet('deals?status=won&limit=200', token);
    for (const d of (all || [])) {
      if (Number(d.pipeline_id) === PIPELINE_VENDAS_SPOT) continue;
      const email = d.person_id?.email?.[0]?.value;
      const phone = d.person_id?.phone?.[0]?.value;
      if ((personEmail && email === personEmail) || (personPhone && phone === personPhone)) {
        wonDeals.push({ id: d.id, title: d.title, pipeline_id: d.pipeline_id, stage_name: d.stage_name || '', value: d.value || 0, won_time: d.won_time || '' });
      }
    }
  } catch { /* non-critical */ }
  return wonDeals;
}
