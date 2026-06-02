import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Rate limiter keyed by IP — no auth required since nothing is stored
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now > record.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (record.count >= 10) return true;
  record.count++;
  return false;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many test requests. Please wait a minute.' },
      { status: 429 }
    );
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 }); }

  const { host, port, username, password, databaseName } = body;

  if (!host) return NextResponse.json({ success: false, error: 'Host URL is required.' }, { status: 400 });
  if (!username) return NextResponse.json({ success: false, error: 'Username is required.' }, { status: 400 });
  if (!databaseName) return NextResponse.json({ success: false, error: 'Database name is required.' }, { status: 400 });
  if (!password) return NextResponse.json({ success: false, error: 'Password is required.' }, { status: 400 });

  // Build the base URL — strip trailing slash, append port if not already in the URL
  let baseUrl = host.replace(/\/$/, '');
  if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
  if (port && !baseUrl.includes(`:${port}`)) baseUrl = `${baseUrl}:${port}`;

  const start = Date.now();
  const debugCommand = `curl --user '${username}:<password>' --data-binary 'SELECT 1' '${baseUrl}/?database=${encodeURIComponent(databaseName)}'`;

  try {
    // Use a raw HTTP request — same as the curl in the ClickHouse console.
    // This is faster and avoids client library TLS issues in serverless environments.
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    const res = await fetch(`${baseUrl}/?query=SELECT+1+AS+ok%2C+version()+AS+version+FORMAT+JSONEachRow&database=${encodeURIComponent(databaseName)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    const latency = Date.now() - start;

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        success: false,
        error: 'Authentication failed. Check the username and password.',
        debugCommand,
      }, { status: 400 });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({
        success: false,
        error: `ClickHouse returned an error: ${text.slice(0, 200)}`,
        debugCommand,
      }, { status: 400 });
    }

    const text = await res.text();
    const rows = text.trim().split('\n').map((l: string) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const version = rows[0]?.version || 'unknown';

    return NextResponse.json({ success: true, latencyMs: latency, version, debugCommand });

  } catch (err: any) {
    const msg = err.message || '';
    let userMessage = 'Could not connect. Check the host URL and port.';
    if (msg.includes('ECONNREFUSED')) userMessage = 'Connection refused. Check the host and port.';
    else if (msg.includes('timeout') || msg.includes('TimeoutError')) userMessage = 'Connection timed out. The host may be unreachable from this server.';
    else if (msg.includes('ENOTFOUND')) userMessage = 'Host not found. Double-check the Host URL.';
    else if (msg.includes('SSL') || msg.includes('certificate')) userMessage = 'SSL error. Ensure the host uses HTTPS on port 8443.';

    console.error('[Connection Test]', msg);
    return NextResponse.json({ success: false, error: userMessage, debugCommand }, { status: 400 });
  }
}
