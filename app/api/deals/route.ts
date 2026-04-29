import { NextResponse } from 'next/server';
import { pipedriveGet, PIPELINE_VENDAS_SPOT } from '@/lib/pipedrive';

export async function GET() {
  try {
    const token = process.env.PIPEDRIVE_API_TOKEN!;
    const raw = await pipedriveGet(
      `deals?pipeline_id=${PIPELINE_VENDAS_SPOT}&status=open&limit=500`,
      token
    );
    const deals = (raw || [])
      .map((d: Record<string, unknown>) => ({
        deal_id: d.id as number,
        person_name:
          (d.person_id as { name?: string } | null)?.name ||
          (d.title as string) ||
          'Lead sem nome',
        stage_name: (d.stage_name as string) || '',
      }))
      .sort((a: { person_name: string }, b: { person_name: string }) =>
        a.person_name.localeCompare(b.person_name, 'pt-BR')
      );
    return NextResponse.json({ deals });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
