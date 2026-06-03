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

    // Process reports for the UI and compute text summaries on-the-fly
    const clientReports = reports.map((r: any) => {
      let plainTextSummary = '';
      if (r.report_html) {
        plainTextSummary = r.report_html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
          .replace(/<[^>]+>/g, ' ') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
      }

      return {
        id: r.id,
        query: r.query,
        summary: plainTextSummary,
        timestamp: r.timestamp,
        pdfUrl: `/api/analytics/export/${r.id}?format=pdf`,
        htmlUrl: `/api/analytics/html/${r.id}`,
        hasPdf: true,
        hasHtml: !!r.report_html,
      };
    });

    return NextResponse.json({ success: true, data: clientReports });
  } catch (error: any) {
    console.error('[Reports] Fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
