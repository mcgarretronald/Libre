import { NextResponse } from 'next/server';
import { internalClient } from '@/lib/clickhouse';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'pdf';
  const { id } = await params;

  // Retrieve the generated HTML layout for the specified report
  let htmlMarkup = '';
  try {
    const result = await internalClient.query({
      query: `SELECT report_html FROM jacaranda_reports WHERE id = '${id}'`,
      format: 'JSONEachRow'
    });
    const rows = await result.json() as any[];
    if (rows.length === 0 || !rows[0].report_html) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    htmlMarkup = rows[0].report_html;
  } catch (err: any) {
    return NextResponse.json({ error: 'Database error: ' + err.message }, { status: 500 });
  }

  // Render the HTML string in a headless browser to generate the PDF/PNG snapshot
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puppeteer = (await import('puppeteer-core' as any)).default;

    const chromium = (await import('@sparticuz/chromium')).default;
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    await page.setContent(htmlMarkup, { waitUntil: 'networkidle0' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawBuffer: any;
    let contentType: string;
    let filename: string;

    if (format === 'png') {
      rawBuffer   = await page.screenshot({ type: 'png', fullPage: true });
      contentType = 'image/png';
      filename    = `jacaranda-report-${id}.png`;
    } else {
      rawBuffer   = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      });
      contentType = 'application/pdf';
      filename    = `jacaranda-report-${id}.pdf`;
    }

    await browser.close();

    const bytes = new Uint8Array(rawBuffer as ArrayBuffer);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('[Export] Puppeteer error:', err.message);
    return NextResponse.json({ error: 'Export failed: ' + err.message }, { status: 500 });
  }
}
