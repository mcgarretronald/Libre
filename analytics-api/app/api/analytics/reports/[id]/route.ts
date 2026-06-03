import { NextResponse } from 'next/server';
import { internalClient } from '@/lib/clickhouse';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // ClickHouse deletion is an asynchronous mutation
    await internalClient.query({
      query: `ALTER TABLE jacaranda_reports DELETE WHERE id = '${id}'`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Reports] Delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
