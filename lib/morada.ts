const MORADA_BASE = 'https://metabase.morada.ai';
const CONVERSAS_CARD = 1427;

export interface MoradaConversation {
  conversa_id: string;
  conversation_link: string | null;
  iniciada_em: string | null;
  finalizada_em: string | null;
  lead_nome: string | null;
  lead_email: string | null;
  lead_telefone: string | null;
  deal_id_externo: string | null;
  [key: string]: unknown;
}

function rowsToObjects(
  cols: Array<{ name: string }>,
  rows: unknown[][]
): Record<string, unknown>[] {
  return rows.map(row => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => { obj[col.name] = row[i]; });
    return obj;
  });
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-9) : null;
}

export async function fetchMoradaConversation(
  apiKey: string,
  dealId: string,
  personEmail: string | null,
  personPhone: string | null
): Promise<MoradaConversation | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${MORADA_BASE}/api/card/${CONVERSAS_CARD}/query/json`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        parameters: [
          {
            type: 'date/relative',
            target: ['variable', ['template-tag', 'conversa_iniciada_em']],
            value: 'past180days',
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Morada API ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const data = json.data ?? json;
    const cols: Array<{ name: string }> = data.cols ?? [];
    const rows: unknown[][] = data.rows ?? [];

    const conversations = rowsToObjects(cols, rows) as MoradaConversation[];

    // Priority 1: match by deal_id_externo
    const byDealId = conversations.find(
      c => c.deal_id_externo != null && String(c.deal_id_externo) === String(dealId)
    );
    if (byDealId) return byDealId;

    // Priority 2: match by email
    const emailLower = personEmail?.toLowerCase().trim();
    if (emailLower) {
      const byEmail = conversations.find(
        c => c.lead_email && String(c.lead_email).toLowerCase().trim() === emailLower
      );
      if (byEmail) return byEmail;
    }

    // Priority 3: match by phone (last 9 digits)
    const phoneNorm = normalizePhone(personPhone);
    if (phoneNorm) {
      const byPhone = conversations.find(c => {
        const cPhone = normalizePhone(String(c.lead_telefone ?? ''));
        return cPhone === phoneNorm;
      });
      if (byPhone) return byPhone;
    }

    return null;
  } finally {
    clearTimeout(timer);
  }
}
