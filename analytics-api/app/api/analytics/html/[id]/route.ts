import { MongoClient } from 'mongodb';

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://mcgarretronald_db_user:kYiKPjPnzfzQ4EXU@cluster0.gz3v4x7.mongodb.net/LibreChat?appName=Cluster0';

declare global {
  // eslint-disable-next-line no-var
  var _htmlRouteMongoPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;
if (!global._htmlRouteMongoPromise) {
  const client = new MongoClient(MONGO_URI);
  global._htmlRouteMongoPromise = client.connect();
}
clientPromise = global._htmlRouteMongoPromise!;

const SECURITY_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'private, max-age=3600',
  // Allow Chart.js CDN inside the iframe and prevent source map fetch errors
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://cdn.jsdelivr.net",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const client = await clientPromise;
    const db = client.db('LibreChat');

    const numericId = parseInt(id, 10);
    const report = await db.collection('jacaranda_reports').findOne(
      !isNaN(numericId) ? { id: numericId } : { id }
    );

    if (!report) {
      return new Response(errorHtml('Report not found', id), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (report.htmlMarkup) {
      // Inject Jacaranda branded frame around LibreChat's HTML artifact
      const wrapped = injectBrandFrame(report.htmlMarkup, {
        query: report.query,
        id: String(id),
        timestamp: report.timestamp,
        brandColors: report.brandColors,
        fallbackSimulated: report.fallbackSimulated,
      });
      return new Response(wrapped, { status: 200, headers: SECURITY_HEADERS });
    }

    // Fallback: render tabular data if no htmlMarkup stored
    const dataset = (() => {
      try {
        return JSON.parse(report.details || '[]');
      } catch {
        return [];
      }
    })();
    return new Response(buildTabularFallback(report, dataset), {
      status: 200,
      headers: SECURITY_HEADERS,
    });
  } catch (err: any) {
    console.error('[HTML Route] Error:', err);
    return new Response(errorHtml('Failed to load report', id), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

// ── Inject a thin Jacaranda header/footer around LibreChat's artifact HTML ─
interface FrameContext {
  query: string;
  id: string;
  timestamp: string;
  brandColors?: Record<string, string> | null;
  fallbackSimulated?: boolean;
}

function injectBrandFrame(artifactHtml: string, ctx: FrameContext): string {
  const primary = ctx.brandColors?.primary || '#FF5A1F';
  const secondary = ctx.brandColors?.secondary || '#7C73C0';
  const date = new Date(ctx.timestamp).toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let wrapped = artifactHtml;
  // Just add clean padding wrapper — no topbar, no footer banner
  if (wrapped.match(/<body[^>]*>/i)) {
    wrapped = wrapped.replace(/(<body[^>]*>)/i, `$1\n<div class="artifact-body" style="min-height:300px;">\n`);
  } else {
    wrapped = `<div class="artifact-body" style="min-height:300px;">\n${wrapped}`;
  }

  if (wrapped.match(/<\/body>/i)) {
    wrapped = wrapped.replace(/(<\/body>)/i, `\n</div>\n$1`);
  } else {
    wrapped = `${wrapped}\n</div>`;
  }

  return wrapped;
}

function buildTabularFallback(report: any, dataset: any[]): string {
  const primary = report.brandColors?.primary || '#FF5A1F';
  const keys = dataset.length ? Object.keys(dataset[0]) : [];
  const rows = dataset
    .map((r: any) => `<tr>${keys.map((k) => `<td>${r[k] ?? '—'}</td>`).join('')}</tr>`)
    .join('');
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet"/>
<style>
  body{font-family:Inter,sans-serif;padding:24px;color:#1e293b;background:#f8fafc}
  h2{color:${primary};margin-bottom:8px}p{color:#475569;font-size:14px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse}
  th{background:#1e293b;color:#fff;padding:10px 14px;font-size:11px;text-align:left}
  td{padding:9px 14px;border-bottom:1px solid #e2e8f0;font-size:13px}
  tr:nth-child(even)td{background:#f1f5f9}
</style></head>
<body>
<h2>${report.query}</h2>
<p>${report.summary}</p>
${keys.length ? `<table><thead><tr>${keys.map((k: string) => `<th>${k.replace(/_/g, ' ')}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>` : '<p>No data records returned.</p>'}
</body></html>`;
}

function errorHtml(msg: string, id: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;color:#dc2626">
<h2>⚠ ${msg}</h2><p>Report ID: ${id}</p></body></html>`;
}
