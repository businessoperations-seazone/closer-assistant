import { streamText, tool, zodSchema, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { getFullDealData, checkWonHistory, fetchNektData, PIPELINE_VENDAS_SPOT } from '@/lib/pipedrive';
import { supabaseServer } from '@/lib/supabase';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export async function POST(req: Request) {
  const body = await req.json();
  const dealId: string = body.dealId ?? body.messages?.at(-1)?.parts?.[0]?.text?.match(/\d{4,}/)?.[0] ?? '';
  const token = process.env.PIPEDRIVE_API_TOKEN!;

  const result = streamText({
    model: openrouter('anthropic/claude-sonnet-4-6'),
    stopWhen: stepCountIs(12),
    system: `Você é o Closer Assistant — agente de inteligência comercial da Seazone Investimentos.
Missão: preparar o closer para a reunião com o lead, com briefing completo e estratégia baseada em dados.

Ao receber um deal_id:
1. Chame get_pipedrive_deal para buscar todos os dados
2. Chame check_won_history para verificar conversões anteriores
3. Chame find_similar_leads para extrair padrões de leads similares
4. Gere o briefing estruturado abaixo

Pipeline Vendas Spot ID: ${PIPELINE_VENDAS_SPOT}

## Formato do briefing:

## 👤 Perfil do Lead
[nome, contato, perfil financeiro, interesse declarado]

## 📋 Histórico no CRM
[atividades relevantes, notas da MIA, estágio atual]

## ⚠️ Pontos de Atenção
[lista de alertas, objeções prováveis, oportunidades identificadas]

## 🎯 Estratégia de Abordagem
[com base nos leads similares e no perfil, como conduzir a reunião]

## 💬 Script de Abertura Sugerido
[script de 3-5 frases para o closer usar ao iniciar a reunião]

## 📊 Leads Similares (ML)
[tabela dos leads mais próximos e o que funcionou/não funcionou]

Seja direto e prático — o closer tem 2 minutos para ler antes da reunião.`,
    messages: [
      { role: 'user', content: `Gere o briefing para o deal ID: ${dealId}` },
    ],
    tools: {
      get_pipedrive_deal: tool({
        description: 'Busca todos os dados do deal no Pipedrive: lead, notas, atividades, dados da MIA',
        inputSchema: zodSchema(z.object({
          deal_id: z.string().describe('ID do deal no Pipedrive'),
        })),
        execute: async (input) => {
          try {
            const data = await getFullDealData(input.deal_id, token);
            if (Number(data.pipeline_id) !== PIPELINE_VENDAS_SPOT) {
              return { error: `Deal pertence ao pipeline ${data.pipeline_id}, não ao Vendas Spot (${PIPELINE_VENDAS_SPOT})` };
            }
            const nektKey = process.env.NEKT_API_KEY;
            let nektData = null;
            if (nektKey && data.leadgen_id) {
              nektData = await fetchNektData(data.leadgen_id, nektKey);
            }
            await supabaseServer().from('ca_lead_profiles').upsert({
              deal_id: data.deal_id,
              person_name: data.person_name,
              person_email: data.person_email,
              person_phone: data.person_phone,
              lead_ads_data: nektData || {},
              mia_notes: data.notes.map((n: { content: string }) => n.content).join('\n---\n'),
              pipedrive_activities: data.activities,
              pipedrive_stage: data.stage_name,
              pipeline_id: data.pipeline_id,
            }, { onConflict: 'deal_id' });
            return { ...data, nekt_data: nektData };
          } catch (e) {
            return { error: String(e) };
          }
        },
      }),

      check_won_history: tool({
        description: 'Verifica se o lead já converteu (ganhou deal) em outros empreendimentos da Seazone',
        inputSchema: zodSchema(z.object({
          person_email: z.string().nullable(),
          person_phone: z.string().nullable(),
        })),
        execute: async (input) => {
          try {
            const wonDeals = await checkWonHistory(input.person_email, input.person_phone, token);
            return { has_prior_conversion: wonDeals.length > 0, won_deals: wonDeals };
          } catch (e) {
            return { error: String(e) };
          }
        },
      }),

      find_similar_leads: tool({
        description: 'Busca leads históricos similares usando análise de padrões (ML). Retorna os mais próximos e o que funcionou na abordagem.',
        inputSchema: zodSchema(z.object({
          budget_range: z.string().describe('Faixa de orçamento do lead atual'),
          objetivo: z.string().nullable().describe('Objetivo do investimento'),
          stage: z.string().describe('Estágio atual do deal'),
        })),
        execute: async (input) => {
          try {
            const db = supabaseServer();
            const { data: profiles } = await db
              .from('ca_lead_profiles')
              .select('deal_id, person_name, lead_ads_data, pipedrive_stage, has_prior_conversion')
              .limit(50);
            const { data: debriefs } = await db
              .from('ca_debriefs')
              .select('deal_id, follow_up_type, meeting_summary')
              .limit(50);
            if (!profiles || profiles.length === 0) {
              return { similar_leads: [], insight: 'Primeiro lead registrado — sem histórico para comparação ainda.' };
            }
            const debriefsMap: Record<string, { follow_up_type: string; meeting_summary: string }> = {};
            for (const d of (debriefs || [])) debriefsMap[d.deal_id] = d;
            const enriched = profiles.map((p: Record<string, unknown>) => ({
              ...p,
              debrief: debriefsMap[p.deal_id as string] || null,
            }));
            return {
              similar_leads: enriched.slice(0, 5),
              total_profiles: profiles.length,
              insight: `${profiles.length} leads no histórico. Objetivo buscado: ${input.objetivo || 'N/A'}, budget: ${input.budget_range}.`,
            };
          } catch (e) {
            return { error: String(e) };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
