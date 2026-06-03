import { NextResponse } from 'next/server';
import { internalClient, initializeReportsTable } from '@/lib/clickhouse';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initializeReportsTable();

    const result = await internalClient.query({
      query: `SELECT id, query_text as query, report_html, created_at as timestamp FROM jacaranda_reports ORDER BY created_at DESC LIMIT 20`,
      format: 'JSONEachRow'
    });
    
    const reports = await result.json() as any[];

    // Strip large HTML blobs and replace with URL references for the UI
    const clientReports = reports.map((r: any) => ({
      id: r.id,
      query: r.query,
      timestamp: r.timestamp,
      pdfUrl: `/api/analytics/export/${r.id}?format=pdf`,
      htmlUrl: `/api/analytics/html/${r.id}`,
      hasPdf: true,
      hasHtml: !!r.report_html,
    }));

    return NextResponse.json({ success: true, data: clientReports });
  } catch (error: any) {
    console.error('[Reports] Fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
