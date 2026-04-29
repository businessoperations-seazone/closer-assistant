import { pipedrivePost } from '@/lib/pipedrive';
import { supabaseServer } from '@/lib/supabase';

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
            content: `Você é o Closer Assistant — agente pós-reunião da Seazone Investimentos.
Analise as notas da reunião e retorne SOMENTE um JSON válido, sem texto adicional, no formato exato abaixo:
{
  "meeting_summary": "resumo de 3-5 frases",
  "action_items": ["item 1", "item 2", "item 3"],
  "follow_up_type": "hot|warm|cold|nurture",
  "follow_up_justification": "justificativa em 1 frase",
  "follow_up_script": "mensagem pronta para WhatsApp",
  "pipedrive_note_html": "conteúdo HTML da nota para o Pipedrive",
  "activity_subject": "assunto da atividade de follow-up",
  "activity_type": "call|email|meeting|task",
  "activity_due_date": "YYYY-MM-DD",
  "activity_note": "observação sobre o follow-up",
  "briefing_text": "texto completo formatado em markdown para mostrar ao closer"
}`,
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

function addBusinessDays(days: number): string {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().split('T')[0]!;
}

export async function POST(req: Request) {
  const body = await req.json();
  const dealId: string = body.dealId ?? '';
  const meetingNotes: string = body.meetingNotes ?? '';
  const token = process.env.PIPEDRIVE_API_TOKEN!;

  if (!dealId || !meetingNotes) {
    return Response.json({ error: 'Deal ID e notas da reunião são obrigatórios' }, { status: 400 });
  }

  // Ask Claude to analyze meeting notes and return structured JSON
  const rawResponse = await callHub(
    `Deal ID: ${dealId}\n\nNotas da reunião:\n${meetingNotes}\n\nData de hoje: ${new Date().toISOString().split('T')[0]}\nData sugerida para follow-up (+2 dias úteis): ${addBusinessDays(2)}`
  );

  // Parse the JSON response
  let analysis: {
    meeting_summary: string;
    action_items: string[];
    follow_up_type: 'hot' | 'warm' | 'cold' | 'nurture';
    follow_up_justification: string;
    follow_up_script: string;
    pipedrive_note_html: string;
    activity_subject: string;
    activity_type: 'call' | 'email' | 'meeting' | 'task';
    activity_due_date: string;
    activity_note: string;
    briefing_text: string;
  };

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    analysis = JSON.parse(jsonMatch?.[0] ?? rawResponse);
  } catch {
    return Response.json({ error: 'Erro ao processar resposta da IA', raw: rawResponse.slice(0, 500) }, { status: 500 });
  }

  // Execute Pipedrive actions in parallel
  const [noteResult, activityResult] = await Promise.allSettled([
    pipedrivePost('notes', token, {
      content: `<b>📋 Resumo gerado pelo Closer Assistant</b><br><br>${analysis.pipedrive_note_html}`,
      deal_id: Number(dealId),
    }),
    pipedrivePost('activities', token, {
      subject: analysis.activity_subject,
      type: analysis.activity_type,
      due_date: analysis.activity_due_date,
      deal_id: Number(dealId),
      note: analysis.activity_note,
    }),
  ]);

  const noteId = noteResult.status === 'fulfilled' ? String(noteResult.value?.id ?? '') : null;
  const activityId = activityResult.status === 'fulfilled' ? String(activityResult.value?.id ?? '') : null;

  // Save debrief to database
  await supabaseServer().from('ca_debriefs').insert({
    deal_id: dealId,
    meeting_notes_raw: meetingNotes,
    meeting_summary: analysis.meeting_summary,
    action_items: analysis.action_items,
    follow_up_type: analysis.follow_up_type,
    follow_up_script: analysis.follow_up_script,
    pipedrive_updated: true,
    pipedrive_note_id: noteId,
    pipedrive_activity_id: activityId,
  }).then(() => {}, () => {});

  return Response.json({
    briefing: analysis.briefing_text,
    meeting_summary: analysis.meeting_summary,
    action_items: analysis.action_items,
    follow_up_type: analysis.follow_up_type,
    follow_up_justification: analysis.follow_up_justification,
    follow_up_script: analysis.follow_up_script,
    pipedrive: {
      note_created: noteResult.status === 'fulfilled',
      note_id: noteId,
      activity_created: activityResult.status === 'fulfilled',
      activity_id: activityId,
      activity_due_date: analysis.activity_due_date,
    },
  });
}
