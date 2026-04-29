import { getFullDealData, checkWonHistory, PIPELINE_VENDAS_SPOT } from '@/lib/pipedrive';
import { supabaseServer } from '@/lib/supabase';
import { fetchMoradaConversation } from '@/lib/morada';

async function callHub(prompt: string): Promise<string> {
  const res = await fetch(
    `${process.env.HUB_BASE_URL ?? 'https://hub.seazone.dev/v1'}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        messages: [
          {
            role: 'system',
            content: 'Você é o Closer Assistant — agente de inteligência comercial da Seazone Investimentos. Gere briefings completos e práticos. O closer tem 2 minutos para ler. Use dados reais. Não invente informações.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4000,
        stream: false,
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hub API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function POST(req: Request) {
  const body = await req.json();
  const dealId: string = body.dealId ?? '';
  const token = process.env.PIPEDRIVE_API_TOKEN!;

  if (!dealId) {
    return Response.json({ error: 'Deal ID não informado' }, { status: 400 });
  }

  // Fetch deal data first (needed for email/phone to do parallel calls)
  let deal: Awaited<ReturnType<typeof getFullDealData>> | null = null;
  try {
    deal = await getFullDealData(dealId, token);
  } catch (e) {
    return Response.json({ error: `Erro ao buscar deal: ${e}` }, { status: 500 });
  }

  if (Number(deal.pipeline_id) !== PIPELINE_VENDAS_SPOT) {
    return Response.json({
      error: `Deal pertence ao pipeline ${deal.pipeline_id}, não ao Vendas Spot (${PIPELINE_VENDAS_SPOT})`,
    }, { status: 400 });
  }

  // Fetch remaining data in parallel
  const [wonResult, moradaResult, similarResult] = await Promise.allSettled([
    checkWonHistory(deal.person_email, deal.person_phone, token),
    (async () => {
      const key = process.env.MORADA_API_KEY;
      if (!key) return null;
      return fetchMoradaConversation(key, dealId, deal!.person_email, deal!.person_phone);
    })(),
    (async () => {
      const db = supabaseServer();
      const [{ data: profiles }, { data: debriefs }] = await Promise.all([
        db.from('ca_lead_profiles').select('deal_id, person_name, pipedrive_stage, has_prior_conversion').limit(50),
        db.from('ca_debriefs').select('deal_id, follow_up_type, meeting_summary').limit(50),
      ]);
      return { profiles: profiles ?? [], debriefs: debriefs ?? [] };
    })(),
  ]);

  const wonDeals = wonResult.status === 'fulfilled' ? wonResult.value : [];
  const morada = moradaResult.status === 'fulfilled' ? moradaResult.value : null;
  const similar = similarResult.status === 'fulfilled' ? similarResult.value : null;

  // Save lead profile (fire-and-forget)
  supabaseServer().from('ca_lead_profiles').upsert({
    deal_id: deal.deal_id,
    person_name: deal.person_name,
    person_email: deal.person_email,
    person_phone: deal.person_phone,
    lead_ads_data: {},
    mia_notes: deal.notes.map((n: { content: string }) => n.content).join('\n---\n'),
    pipedrive_activities: deal.activities,
    pipedrive_stage: deal.stage_name,
    pipeline_id: deal.pipeline_id,
  }, { onConflict: 'deal_id' }).then(() => {}, () => {});

  // Build context
  const activitiesText = deal.activities.slice(0, 5).map((a: {
    type: string; subject: string; due_date: string; note: string; done: boolean
  }) =>
    `- [${a.done ? '✓' : '⏳'}] ${a.due_date} | ${a.subject}\n  ${a.note?.replace(/<[^>]+>/g, '').slice(0, 200) ?? '(sem nota)'}`
  ).join('\n');

  const notesText = deal.notes.length > 0
    ? deal.notes.slice(0, 3).map((n: { content: string }) => n.content.replace(/<[^>]+>/g, '').slice(0, 300)).join('\n---\n')
    : 'Nenhuma nota registrada';

  const moradaText = morada
    ? `ENCONTRADA. ID: ${morada.conversa_id}. Link: ${morada.conversation_link ?? 'N/A'}. Dados: ${JSON.stringify(morada).slice(0, 600)}`
    : 'Nenhuma conversa encontrada nos últimos 180 dias.';

  const similarText = similar?.profiles?.length
    ? similar.profiles.slice(0, 5).map((p: Record<string, unknown>) =>
        `- ${p.person_name} | estágio: ${p.pipedrive_stage} | converteu: ${p.has_prior_conversion ? 'sim' : 'não'}`
      ).join('\n')
    : 'Sem histórico suficiente para comparação.';

  const text = await callHub(`Gere o briefing para o deal ${dealId}:

## Dados do Deal
Lead: ${deal.person_name}
Email: ${deal.person_email ?? 'não informado'}
Telefone: ${deal.person_phone ?? 'não informado'}
Responsável: ${deal.owner_name}
Estágio: ${deal.stage_name || 'não identificado'}
Empreendimento ID: ${deal.raw_empreendimento_id ?? 'não identificado'}
Budget MIA: ${deal.mia_budget ?? 'não informado'}
Objetivo MIA: ${deal.mia_objetivo ?? 'não informado'}
Forma de pagamento MIA: ${deal.mia_forma_pagamento ?? 'não informada'}

## Atividades recentes
${activitiesText || 'Nenhuma atividade registrada'}

## Notas no CRM
${notesText}

## Conversa MIA (pré-deal)
${moradaText}

## Histórico de conversões
${wonDeals.length > 0 ? `Lead já converteu ${wonDeals.length} vez(es) na Seazone.` : 'Primeira interação com a Seazone.'}

## Leads similares no banco
${similarText}

## Formato obrigatório:

## 👤 Perfil do Lead
[nome, contato, interesse, perfil financeiro]

## 💬 Jornada na MIA (Pré-Deal)
[o que o lead disse: interesse, budget, objeções — ou informar que não há registro]

## 📋 Histórico no CRM
[atividades relevantes, estágio, responsável]

## ⚠️ Pontos de Atenção
[alertas, objeções prováveis, oportunidades]

## 🎯 Estratégia de Abordagem
[como conduzir a reunião com base no perfil]

## 💬 Script de Abertura Sugerido
[3-5 frases prontas para usar ao iniciar a reunião]

## 📊 Contexto do Mercado
[padrões de leads similares se disponíveis; omita se não houver dados]`);

  return Response.json({ briefing: text, deal_id: dealId, person_name: deal.person_name });
}
