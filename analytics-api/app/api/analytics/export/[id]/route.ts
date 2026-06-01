import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://mcgarretronald_db_user:kYiKPjPnzfzQ4EXU@cluster0.gz3v4x7.mongodb.net/?appName=Cluster0';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'pdf';
  const { id } = await params;
  const reportId = parseInt(id, 10);

  // Fetch the HTML from MongoDB
  let htmlMarkup = '';
  try {
    const mongo = new MongoClient(MONGO_URI);
    await mongo.connect();
    const doc = await mongo
      .db('LibreChat')
      .collection('jacaranda_reports')
      .findOne({ id: reportId });
    await mongo.close();
    if (!doc?.htmlMarkup) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    htmlMarkup = doc.htmlMarkup;
  } catch (err: any) {
    return NextResponse.json({ error: 'DB error: ' + err.message }, { status: 500 });
  }

  // Launch puppeteer
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puppeteer = (await import('puppeteer-core' as any)).default;

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 800, height: 600 },
      executablePath: '/usr/bin/chromium-browser',
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    await page.setContent(htmlMarkup, { waitUntil: 'networkidle0' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawBuffer: any;
    let contentType: string;
    let filename: string;

    if (format === 'png') {
      rawBuffer    = await page.screenshot({ type: 'png', fullPage: true });
      contentType  = 'image/png';
      filename     = `jacaranda-report-${reportId}.png`;
    } else {
      rawBuffer    = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      });
      contentType  = 'application/pdf';
      filename     = `jacaranda-report-${reportId}.pdf`;
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
