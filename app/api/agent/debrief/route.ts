import { streamText, tool, zodSchema, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { pipedrivePost } from '@/lib/pipedrive';
import { supabaseServer } from '@/lib/supabase';

const hub = createOpenAI({
  baseURL: process.env.HUB_BASE_URL ?? 'https://hub.seazone.dev/v1',
  apiKey: process.env.HUB_API_KEY!,
});

export async function POST(req: Request) {
  const body = await req.json();
  const dealId: string = body.dealId ?? '';
  const meetingNotes: string = body.meetingNotes ?? '';
  const token = process.env.PIPEDRIVE_API_TOKEN!;

  const result = streamText({
    model: hub('claude-sonnet-4-6'),
    stopWhen: stepCountIs(8),
    system: `Você é o Closer Assistant — agente pós-reunião da Seazone Investimentos.
Missão: processar as notas da reunião e:
1. Gerar resumo executivo
2. Extrair action items concretos
3. Classificar o follow-up (hot/warm/cold/nurture)
4. Criar script de follow-up personalizado
5. Criar nota no Pipedrive (create_pipedrive_note)
6. Agendar atividade de follow-up (create_pipedrive_activity) — data estimada: +2 dias úteis
7. Salvar debrief no banco (save_debrief)

Zero input manual do closer. Tudo automatizado.

## Formato do output:

## 📝 Resumo da Reunião
[3-5 frases resumindo o que foi discutido]

## ✅ Action Items
[lista numerada de próximas ações concretas]

## 🌡️ Temperatura do Lead: [HOT/WARM/COLD/NURTURE]
[justificativa em 1 frase]

## 💬 Script de Follow-up
[mensagem pronta para WhatsApp, personalizada com o que foi discutido]

## 🔄 Pipedrive Atualizado
[confirmação do que foi criado no CRM]`,
    messages: [
      {
        role: 'user',
        content: `Deal ID: ${dealId}\n\nNotas da reunião:\n${meetingNotes}`,
      },
    ],
    tools: {
      create_pipedrive_note: tool({
        description: 'Cria uma nota no deal do Pipedrive com o resumo da reunião',
        inputSchema: zodSchema(z.object({
          deal_id: z.string(),
          content: z.string().describe('Conteúdo HTML da nota'),
        })),
        execute: async (input) => {
          try {
            const note = await pipedrivePost('notes', token, {
              content: `<b>📋 Resumo gerado pelo Closer Assistant</b><br><br>${input.content}`,
              deal_id: Number(input.deal_id),
            });
            return { success: true, note_id: note?.id };
          } catch (e) {
            return { success: false, error: String(e) };
          }
        },
      }),

      create_pipedrive_activity: tool({
        description: 'Cria uma atividade de follow-up no Pipedrive',
        inputSchema: zodSchema(z.object({
          deal_id: z.string(),
          subject: z.string().describe('Assunto da atividade'),
          activity_type: z.enum(['call', 'email', 'meeting', 'task']),
          due_date: z.string().describe('Data no formato YYYY-MM-DD'),
          note: z.string().describe('Observação sobre o follow-up'),
        })),
        execute: async (input) => {
          try {
            const activity = await pipedrivePost('activities', token, {
              subject: input.subject,
              type: input.activity_type,
              due_date: input.due_date,
              deal_id: Number(input.deal_id),
              note: input.note,
            });
            return { success: true, activity_id: activity?.id };
          } catch (e) {
            return { success: false, error: String(e) };
          }
        },
      }),

      save_debrief: tool({
        description: 'Salva o debrief completo no banco de dados',
        inputSchema: zodSchema(z.object({
          deal_id: z.string(),
          meeting_summary: z.string(),
          action_items: z.array(z.string()),
          follow_up_type: z.enum(['hot', 'warm', 'cold', 'nurture']),
          follow_up_script: z.string(),
          pipedrive_note_id: z.string().optional(),
          pipedrive_activity_id: z.string().optional(),
        })),
        execute: async (input) => {
          try {
            await supabaseServer().from('ca_debriefs').insert({
              deal_id: input.deal_id,
              meeting_notes_raw: meetingNotes,
              meeting_summary: input.meeting_summary,
              action_items: input.action_items,
              follow_up_type: input.follow_up_type,
              follow_up_script: input.follow_up_script,
              pipedrive_updated: true,
              pipedrive_note_id: input.pipedrive_note_id || null,
              pipedrive_activity_id: input.pipedrive_activity_id || null,
            });
            return { success: true };
          } catch (e) {
            return { success: false, error: String(e) };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
