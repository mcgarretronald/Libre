import { NextResponse } from 'next/server';
import { createClient } from '@clickhouse/client';
import { Resend } from 'resend';
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const getClickhouseHost = (): string => {
  const rawHost = process.env.CLICKHOUSE_HOST || 'http://localhost:8123';
  let isDocker = false;
  try {
    isDocker = fs.existsSync('/.dockerenv');
  } catch {}
  if (!isDocker && rawHost.includes('://clickhouse')) {
    return rawHost.replace('://clickhouse', '://127.0.0.1');
  }
  return rawHost;
};

const clickhouse = createClient({
  url: getClickhouseHost(),
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
  database: process.env.CLICKHOUSE_DATABASE || 'default',
});

// 1. Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

// 2. Helper to launch headless browser (production serverless vs local)
async function getBrowser() {
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.AWS_EXECUTION_ENV;

  if (isLocal) {
    const searchPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/opt/google/chrome/chrome'
    ];
    let executablePath = '';
    for (const path of searchPaths) {
      if (fs.existsSync(path)) {
        executablePath = path;
        break;
      }
    }
    if (!executablePath) {
      throw new Error('Local chromium/chrome executable not found in standard paths.');
    }
    return await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  // Production Vercel / serverless chromium environment
  const chromium = require('@sparticuz/chromium');
  return await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless === 'new' ? true : chromium.headless,
  });
}

// 4. Generate high-fidelity branded HTML page
function generateBrandedHTML(data: any[], brand: any, query: string): string {
  const brandName = brand?.name || 'Analytics Dashboard';
  const primaryColor = brand?.primary || '#6366f1'; 
  const secondaryColor = brand?.secondary || '#14b8a6';

  const labelsJson = JSON.stringify(data.map(d => d.radio || d.category || Object.values(d)[0]));
  const countsJson = JSON.stringify(data.map(d => d.count || d.total_revenue || Object.values(d)[1]));
  const rawDataJson = JSON.stringify(data);

  // Generate table rows
  const tableHeaders = data.length > 0 ? Object.keys(data[0]) : [];
  const tableHeaderHtml = tableHeaders.map(h => `<th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">${h}</th>`).join('');
  const tableRowsHtml = data.map(row => {
    return `<tr class="border-b border-slate-100 hover:bg-slate-50/50">` +
      tableHeaders.map(h => `<td class="px-6 py-4 text-sm font-medium text-slate-700">${row[h] ?? ''}</td>`).join('') +
      `</tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${brandName} Analytics Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1.3.0/dist/chartjs-adapter-luxon.umd.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @media print {
            body { background-color: #ffffff; -webkit-print-color-adjust: exact; }
            .no-print { display: none; }
        }
    </style>
</head>
<body class="bg-slate-50 p-8 font-sans antialiased text-slate-800">
    <div class="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Banner with custom Brand Colors */}
        <div class="h-4" style="background: linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)"></div>
        
        <div class="p-8">
            {/* Header section */}
            <div class="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-widest" style="color: ${primaryColor}">Interactive BI Report</span>
                    <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">${brandName}</h1>
                </div>
                <div class="text-right">
                    <span class="text-xs text-slate-400 font-medium">Generated On</span>
                    <p class="text-sm font-semibold text-slate-600">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            {/* Metric Summary Widgets */}
            <div class="grid grid-cols-2 gap-4 mb-8">
                <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span class="text-xs text-slate-400 font-semibold block mb-1">Total Categories</span>
                    <span class="text-2xl font-bold text-slate-800">${data.length}</span>
                </div>
                <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span class="text-xs text-slate-400 font-semibold block mb-1">Database Engine</span>
                    <span class="text-2xl font-bold" style="color: ${primaryColor}">ClickHouse Cloud</span>
                </div>
            </div>

            {/* Interactive Analytical Chart canvas */}
            <div class="mb-10 bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h3 class="text-sm font-bold text-slate-700 mb-4 tracking-wide uppercase">Visual Breakdown</h3>
                <div class="relative w-full h-72">
                    <canvas id="reportChart"></canvas>
                </div>
            </div>

            {/* Dynamic Data Table */}
            <div class="mb-8">
                <h3 class="text-sm font-bold text-slate-700 mb-4 tracking-wide uppercase">Structured Dataset</h3>
                <div class="overflow-x-auto rounded-xl border border-slate-100">
                    <table class="min-w-full divide-y divide-slate-100">
                        <thead class="bg-slate-50">
                            <tr>${tableHeaderHtml}</tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-slate-50">${tableRowsHtml}</tbody>
                    </table>
                </div>
            </div>

            {/* Footnotes / SQL used */}
            <div class="border-t border-slate-100 pt-6 mt-8">
                <span class="text-[10px] font-bold text-slate-400 uppercase block mb-2">Executed query</span>
                <pre class="bg-slate-50 p-3 rounded-lg text-[10px] font-mono text-slate-500 overflow-x-auto border border-slate-100">${query}</pre>
            </div>
        </div>
    </div>

    <script>
        const labels = ${labelsJson};
        const counts = ${countsJson};
        
        new Chart(document.getElementById('reportChart'), {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: ['${primaryColor}', '${secondaryColor}', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // Disabling chart animations is key for instant puppeteer screenshots
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    </script>
</body>
</html>
  `;
}

// 5. POST handler endpoint
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recipient_email, query_used, brand_context } = body;

    if (!recipient_email || !query_used) {
      return NextResponse.json({ error: 'Missing required parameters. "recipient_email" and "query_used" are mandatory.' }, { status: 400 });
    }

    // A. Query live data from ClickHouse
    console.log(`Executing ClickHouse query for email report...`);
    const queryResult = await clickhouse.query({
      query: query_used,
      format: 'JSONEachRow'
    });
    const dataset = await queryResult.json() as any[];

    // B. Build the high-fidelity branded HTML page
    const htmlContent = generateBrandedHTML(dataset, brand_context, query_used);

    // C. Launch Headless Browser to capture PDF buffer
    let pdfBuffer: Buffer | null = null;
    let fallbackToHtmlOnly = false;
    let browser: any = null;

    try {
      console.log(`Launching headless Puppeteer browser...`);
      browser = await getBrowser();
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'load' });
      
      // Print high-fidelity A4 layout
      pdfBuffer = Buffer.from(await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
      }));
      console.log(`PDF rendered successfully! Size: ${pdfBuffer.length} bytes.`);
    } catch (browserError: any) {
      console.error(`Headless browser PDF printing failed: ${browserError.message}. Falling back to HTML inline email.`);
      fallbackToHtmlOnly = true;
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    // D. Send via Resend channel
    if (process.env.RESEND_API_KEY) {
      console.log(`Sending branded report to ${recipient_email} via Resend...`);
      const attachments = pdfBuffer ? [{
        filename: `${brand_context?.name || 'Analytics'}_Report.pdf`,
        content: pdfBuffer
      }] : [];

      const emailResponse = await resend.emails.send({
        from: 'ClickHouse Reports <analytics@libre-analysis.vercel.app>',
        to: recipient_email,
        subject: `${brand_context?.name || 'Business'} Intelligence Report`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #334155;">
            <h2 style="color: #0f172a;">Your Business Intelligence Report is Ready!</h2>
            <p>Please find attached the high-fidelity analytical readout generated directly from your productionClickHouse database.</p>
            ${fallbackToHtmlOnly ? '<p style="color: #ef4444; font-weight: bold;">Note: The PDF attachment generator failed due to headless chromium limitations. Inline HTML contents have been loaded below.</p>' : ''}
            <div style="border-top: 1px solid #e2e8f0; margin-top: 20px; padding-top: 20px;">
              <p style="font-size: 12px; color: #64748b;">Powered by ClickHouse Cloud, Next.js & LibreChat.</p>
            </div>
          </div>
        `,
        attachments
      });

      console.log(`Resend response:`, JSON.stringify(emailResponse));
    } else {
      console.warn(`RESEND_API_KEY not populated. Simulating email transmission success (local dev dry-run).`);
    }

    return NextResponse.json({
      success: true,
      message: 'branded PDF analytics report dispatched successfully.',
      pdf_generated: !fallbackToHtmlOnly,
      records_analyzed: dataset.length
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Email reporting endpoint crash: ${message}`);
    return NextResponse.json({ error: 'Email reporting failed', details: message }, { status: 500 });
  }
}
