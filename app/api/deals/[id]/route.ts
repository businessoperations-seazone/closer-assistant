import { NextResponse } from 'next/server';
import { getFullDealData, PIPELINE_VENDAS_SPOT } from '@/lib/pipedrive';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = process.env.PIPEDRIVE_API_TOKEN!;
    const deal = await getFullDealData(id, token);
    if (Number(deal.pipeline_id) !== PIPELINE_VENDAS_SPOT) {
      return NextResponse.json(
        { error: `Deal pertence ao pipeline ${deal.pipeline_id}, não ao Vendas Spot (${PIPELINE_VENDAS_SPOT})` },
        { status: 400 }
      );
    }
    return NextResponse.json({ deal });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
