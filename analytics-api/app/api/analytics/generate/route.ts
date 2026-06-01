import { createClient } from '@clickhouse/client';
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';

// ── ClickHouse ─────────────────────────────────────────────────────────────
const clickhouse = createClient({
  url:      process.env.CLICKHOUSE_HOST     || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER     || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'default',
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/librechat';

// ── Auth token (kept for future LibreChat integration) ─────────────────────
async function getSystemAuthToken(): Promise<string | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  let client: MongoClient | null = null;
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    const db    = client.db('LibreChat');
    const email = 'system_admin@jacaranda.org';
    let user    = await db.collection('users').findOne({ email });
    if (!user) {
      const result = await db.collection('users').insertOne({
        email, name: 'Jacaranda System Agent', provider: 'local',
        role: 'ADMIN', createdAt: new Date(), updatedAt: new Date(),
      });
      user = { _id: result.insertedId, email };
    }
    return jwt.sign({ id: user._id.toString(), email: user.email }, secret, { expiresIn: '1h' });
  } catch { return null; }
  finally { if (client) await client.close(); }
}

// ── OpenAI call ────────────────────────────────────────────────────────────
async function callOpenAI(messages: { role: string; content: any }[]): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { console.error('[BFF] OPENAI_API_KEY missing'); return null; }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o', messages, stream: false }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    console.error('[BFF] OpenAI error:', res.status, await res.text().catch(() => ''));
    return null;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

// ── STEP 1: Fetch ClickHouse schema ───────────────────────────────────────
async function fetchSchema(): Promise<{ tables: string; sample: string }> {
  try {
    // Get tables + columns
    const colResult = await clickhouse.query({
      query: `
        SELECT table, name, type
        FROM system.columns
        WHERE database = currentDatabase()
        ORDER BY table, position
        LIMIT 120
      `,
      format: 'JSONEachRow',
    });
    const cols = await colResult.json() as any[];

    // Group by table
    const tableMap: Record<string, string[]> = {};
    for (const c of cols) {
      if (!tableMap[c.table]) tableMap[c.table] = [];
      tableMap[c.table].push(`${c.name} (${c.type})`);
    }
    const tables = Object.entries(tableMap)
      .map(([t, cs]) => `Table "${t}": ${cs.join(', ')}`)
      .join('\n');

    // Get 3 sample rows from first table
    let sample = '';
    const firstTable = Object.keys(tableMap)[0];
    if (firstTable) {
      const sampleResult = await clickhouse.query({
        query: `SELECT * FROM \`${firstTable}\` LIMIT 3`,
        format: 'JSONEachRow',
      });
      const rows = await sampleResult.json() as any[];
      sample = JSON.stringify(rows, null, 2);
    }

    console.log(`[BFF Pipeline] Schema fetched: ${Object.keys(tableMap).length} tables`);
    return { tables, sample };
  } catch (err: any) {
    console.warn('[BFF Pipeline] Schema fetch failed:', err.message);
    return { tables: '', sample: '' };
  }
}

// ── STEP 2: AI generates SQL ───────────────────────────────────────────────
async function generateSQL(userQuery: string, schema: { tables: string; sample: string }): Promise<string | null> {
  if (!schema.tables) return null;

  const content = await callOpenAI([
    {
      role: 'system',
      content: [
        'You are a ClickHouse SQL expert for Jacaranda Health.',
        'Given the database schema and a user request, write a single ClickHouse SQL SELECT query.',
        'Rules:',
        '- Return ONLY the raw SQL query. No markdown, no backticks, no explanation.',
        '- Use proper ClickHouse syntax.',
        '- LIMIT results to 100 rows max.',
        '- Always use actual column names from the schema — never invent column names.',
        '- If the request cannot be answered with the given schema, return: CANNOT_QUERY',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `User Request: ${userQuery}\n\nDatabase Schema:\n${schema.tables}\n\nSample Data:\n${schema.sample}`,
    },
  ]);

  if (!content || content.trim() === 'CANNOT_QUERY') {
    console.log('[BFF Pipeline] AI could not generate SQL for this query');
    return null;
  }

  // Strip any accidental markdown fences
  return content.replace(/^```sql\s*/i, '').replace(/```\s*$/i, '').trim();
}

// ── STEP 3: Run SQL on ClickHouse ──────────────────────────────────────────
async function runSQL(sql: string): Promise<{ rows: any[]; error: string | null }> {
  try {
    const result = await clickhouse.query({ query: sql, format: 'JSONEachRow' });
    const rows   = await result.json() as any[];
    console.log(`[BFF Pipeline] SQL executed. Rows returned: ${rows.length}`);
    return { rows, error: null };
  } catch (err: any) {
    console.error('[BFF Pipeline] SQL execution failed:', err.message);
    return { rows: [], error: err.message };
  }
}

// ── STEP 4: AI generates HTML chart from real data ─────────────────────────
const CHART_SYSTEM_PROMPT = `You are the Jacaranda Health Analytics AI. You produce clean, production-ready HTML data visualizations.

=== STRICT RULES ===
RULE 1 — HEADER: Include a clean branded header bar at the top of the page with: Jacaranda Health brand name on the left, the report title centered, and today's date on the right. Style it with background:#3B143C, color:#fff, padding:14px 28px.
RULE 2 — NO PLACEHOLDER LABELS: Use ONLY exact real field values from the provided data. Never write "Tower A", "Region 1", "Category X", "Item 1" or any invented stand-ins.
RULE 3 — NO AI DISCLOSURE BADGES: Do not add "Generated by AI Analytics", "Powered by AI" footer badges or banners.

=== CHART TYPE RULES ===
CASE 1 — BROAD / GENERAL QUERY (e.g. "show me tower distribution", "give me an overview", "analyse X", "dashboard"): Generate a MULTI-CHART DASHBOARD with a CSS Grid layout containing:
  - 2–3 KPI stat cards at the top (total counts, averages, etc.)
  - A vertical BAR CHART showing counts/distribution
  - A PIE or DOUGHNUT chart showing proportions
  - A LINE CHART if there is any time or sequential dimension in the data
  This gives the richest possible view of the data.

CASE 2 — SPECIFIC CHART REQUEST (e.g. "show me a bar chart of X", "pie chart of Y"): Generate exactly that chart type and nothing else.

CASE 3 — AMBIGUOUS SINGLE-METRIC QUERY: Default to a BAR CHART as it is the most readable for counts and comparisons.

=== OUTPUT FORMAT ===
First write a DATA-DRIVEN ANALYTICAL SUMMARY (3-5 sentences). This will be displayed to the user and used as the email body.
The summary MUST:
  - Cite specific numbers and percentages from the actual data (e.g. "UMTS accounts for 42% of towers (1,204 sites)")
  - Identify the top performer and bottom performer by name
  - Call out any notable gap, anomaly, or concentration (e.g. "The top two categories together represent 67% of total volume")
  - Include one business implication or recommendation based on the data
  - NEVER just say "here is a visualization" or restate what the chart shows — that is not an analysis
Then output the full HTML wrapped in: :::artifact ... :::

=== HTML PAGE RULES ===
- <body> first child must be: <h1 style="font-size:20px;font-weight:800;color:#1e293b;text-align:center;margin:0 0 24px 0">YOUR TITLE</h1>
- Page layout: max-width:800px; margin:0 auto; background:#fff; padding:28px; font-family:Inter,system-ui,sans-serif.
- Chart.js loaded from CDN. Each canvas wrapped in: <div style="position:relative;height:320px">
- Set maintainAspectRatio:false on every chart instance.
- Color palette: #3B143C, #E06A55, #1E6B65, #7C73C0, #64748b, #94a3b8.
- All JS inside: window.addEventListener("DOMContentLoaded", () => { ... });
- Aesthetic: clean, white, minimal — no heavy shadows, no colored borders.`;

async function generateChart(
  userQuery: string,
  rows: any[],
  sql: string,
  image: string | null,
): Promise<{ htmlMarkup: string; summary: string } | null> {

  const dataContext = rows.length > 0
    ? `\n\nACTUAL QUERY RESULTS (${rows.length} rows — use ONLY these real values for the chart labels and data):\n${JSON.stringify(rows, null, 2)}\n\nSQL that produced this data:\n${sql}`
    : '\n\nNo data was returned from the database. Use realistic domain-specific estimates based on Kenyan telecoms/health infrastructure context. State clearly in the title this is an estimate.';

  const userMessage: any = image
    ? [
        { type: 'text',      text: `User Request: ${userQuery}${dataContext}` },
        { type: 'image_url', image_url: { url: image } },
      ]
    : `User Request: ${userQuery}${dataContext}`;

  const content = await callOpenAI([
    { role: 'system', content: CHART_SYSTEM_PROMPT },
    { role: 'user',   content: userMessage },
  ]);

  if (!content) return null;

  // Extract HTML artifact
  let htmlMarkup = '';
  const artifactMatch = content.match(/:::artifact\s*([\s\S]*?):::/);
  if (artifactMatch) {
    htmlMarkup = artifactMatch[1].trim().replace(/^```html\s*/i, '').replace(/```\s*$/i, '');
  } else {
    const htmlMatch = content.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
    if (htmlMatch) htmlMarkup = htmlMatch[0];
  }

  // Summary = text BEFORE the artifact block (the email body)
  const summary = content
    .split(/:::artifact/)[0]
    .replace(/[#*`]/g, '')
    .trim()
    .slice(0, 800);

  console.log(`[BFF Pipeline] Chart generated. Summary length: ${summary.length}`);
  return htmlMarkup ? { htmlMarkup, summary } : null;
}

// ── Main POST handler ──────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { query, image } = await req.json();
    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    await getSystemAuthToken(); // provision user if needed

    let sql     = '';
    let dataset: any[] = [];

    // ── PIPELINE ──────────────────────────────────────────────────────────
    console.log('[BFF Pipeline] Step 1: Fetching ClickHouse schema...');
    const schema = await fetchSchema();

    if (schema.tables) {
      console.log('[BFF Pipeline] Step 2: Generating SQL...');
      const generatedSQL = await generateSQL(query, schema);

      if (generatedSQL) {
        sql = generatedSQL;
        console.log(`[BFF Pipeline] Step 3: Running SQL:\n${sql}`);
        const { rows, error } = await runSQL(sql);
        if (!error) dataset = rows;
        else console.warn('[BFF Pipeline] SQL error, proceeding with empty dataset:', error);
      } else {
        console.log('[BFF Pipeline] No SQL generated — will use schema context only.');
      }
    }

    console.log('[BFF Pipeline] Step 4: Generating HTML chart...');
    const aiResult = await generateChart(query, dataset, sql, image || null);

    if (!aiResult?.htmlMarkup) {
      return NextResponse.json(
        { success: false, error: 'AI failed to generate a valid chart.' },
        { status: 502 },
      );
    }

    const { htmlMarkup, summary } = aiResult;

    // ── Persist to MongoDB ──────────────────────────────────────────────
    const reportId      = Date.now();
    const reportPayload = {
      id: reportId,
      query,
      timestamp: new Date().toISOString(),
      status: 'Ready',
      summary,   // ← this is the email body
      sql:       sql || undefined,
      details:   dataset.length ? JSON.stringify(dataset, null, 2) : undefined,
      htmlMarkup,
      rowCount:  dataset.length,
      fallbackSimulated: dataset.length === 0,
    };

    try {
      const mongo = new MongoClient(MONGO_URI);
      await mongo.connect();
      await mongo.db('LibreChat').collection('jacaranda_reports').insertOne(reportPayload);
      await mongo.close();
    } catch (mongoErr) {
      console.error('[BFF] MongoDB save failed:', mongoErr);
    }

    return NextResponse.json({
      success: true,
      fallback_simulated: dataset.length === 0,
      report: {
        ...reportPayload,
        htmlUrl: `/api/analytics/html/${reportId}`,
        hasHtml: true,
      },
    });

  } catch (error: any) {
    console.error('[BFF] Generate Route Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
