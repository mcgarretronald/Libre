import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { internalClient, initializeReportsTable } from '@/lib/clickhouse';
import { createClient } from '@clickhouse/client';
import { ObjectId } from 'mongodb';

const LIBRECHAT_URL = (process.env.LIBRECHAT_URL || 'http://localhost:3080').replace(/\/$/, '');

export const dynamic = 'force-dynamic';

// In-memory cache for database schemas to avoid repeatedly querying the target DB
const schemaCache = new Map<string, { timestamp: number; schema: any[] }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Filter database schema by relevance to the query to fit within the AI context window.
function filterSchema(schema: any[], query: string, maxTokens: number = 4000): string {
  const normalizedQuery = query.toLowerCase();
  const keywords = normalizedQuery.split(/\s+/).filter(w => w.length > 3);

  const scoredTables = schema.map(table => {
    let score = 0;
    const tableStr = `${table.table} ${table.columns.join(' ')}`.toLowerCase();
    for (const kw of keywords) {
      if (tableStr.includes(kw)) score += 2;
    }
    return { ...table, score };
  });

  scoredTables.sort((a, b) => b.score - a.score);

  let result = '';
  let currentTokens = 0;

  for (const table of scoredTables) {
    const tableDef = `Table "${table.table}": ${table.columns.join(', ')}\n`;
    const tokens = Math.ceil(tableDef.length / 4);
    if (currentTokens + tokens > maxTokens) break;
    result += tableDef;
    currentTokens += tokens;
  }

  return result || 'No relevant tables found matching the query context.';
}

export async function POST(req: Request) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '') || req.headers.get('cookie')
      ?.split('; ')
      .find(row => row.startsWith('access_token='))
      ?.split('=')[1];

    const { query, databaseId, brandColors, parentReportId } = await req.json();

    if (!databaseId) {
      return NextResponse.json({ error: 'No database selected' }, { status: 400 });
    }

    // Prevent destructive queries from reaching the AI engine
    const normalizedQuery = query.toUpperCase();
    if (
      normalizedQuery.includes('DROP') ||
      normalizedQuery.includes('TRUNCATE') ||
      normalizedQuery.includes('ALTER') ||
      normalizedQuery.includes('DELETE')
    ) {
      return NextResponse.json({ error: 'Destructive commands are not allowed' }, { status: 403 });
    }

    // Retrieve connection credentials
    const { db } = await connectToDatabase();
    const connection = await db.collection('jacaranda_connections').findOne({
      _id: new ObjectId(databaseId),
      userId: session.userId,
    });

    if (!connection) {
      return NextResponse.json({ error: 'Database connection not found or access denied' }, { status: 404 });
    }

    // Check cache for schema to save DB hits
    let rawSchema: any[] = [];
    const cacheKey = connection._id.toString();
    const cached = schemaCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      rawSchema = cached.schema;
    } else {
      let decryptedPassword: string;
      try {
        decryptedPassword = decrypt(connection.password);
      } catch (err: any) {
        console.error('[Generate] Failed to decrypt stored connection password:', err);
        return NextResponse.json({
          error: 'Unable to decrypt the stored database password. Please re-save this connection with a valid encryption key.',
        }, { status: 500 });
      }

      const buildClickHouseUrl = (host: string, port?: string | number) => {
        const normalizedHost = host.startsWith('http') ? host : `https://${host}`;
        const url = new URL(normalizedHost);
        if (port && !url.port) url.port = String(port);
        return url.toString().replace(/\/+$/, '');
      };

      const targetClient = createClient({
        url: buildClickHouseUrl(connection.host, connection.port),
        username: connection.username,
        password: decryptedPassword,
        database: connection.databaseName,
        request_timeout: 60000,
      });

      const colResult = await targetClient.query({
        query: 'SELECT table, name, type FROM system.columns WHERE database = currentDatabase()',
        format: 'JSONEachRow',
      });
      const cols = await colResult.json() as any[];

      const tableMap: Record<string, string[]> = {};
      for (const c of cols) {
        if (!tableMap[c.table]) tableMap[c.table] = [];
        tableMap[c.table].push(`${c.name} (${c.type})`);
      }

      rawSchema = Object.entries(tableMap).map(([table, columns]) => ({ table, columns }));
      schemaCache.set(cacheKey, { timestamp: Date.now(), schema: rawSchema });

      await targetClient.close();
    }

    const injectedSchema = filterSchema(rawSchema, query);
    console.log(`[Generate] Schema tokens used: ~${Math.ceil(injectedSchema.length / 4)}`);
    console.log('[Generate] Injected Schema:\n', injectedSchema);

    // If parentReportId is provided, fetch the parent HTML to append to
    let parentHtml = '';
    if (parentReportId) {
      try {
        const parentResult = await internalClient.query({
          query: `SELECT report_html FROM jacaranda_reports WHERE id = '${parentReportId}' AND user_id = '${session.userId}' LIMIT 1`,
          format: 'JSONEachRow',
        });
        const parentRows = await parentResult.json() as any[];
        if (parentRows.length > 0) {
          parentHtml = parentRows[0].report_html;
        }
      } catch (err) {
        console.warn('[Generate] Failed to fetch parent report HTML:', err);
      }
    }

    let promptContent = `You are an expert BI engine. Produce a comprehensive, beautiful multi-chart HTML layout using Chart.js.
Use these brand colors for datasets: ${JSON.stringify(brandColors || { primary: '#4A154B', secondary: '#E06A55', accent: '#1E6B65' })}.
Do not output emojis or decorative icons.

CRITICAL HTML RULES:
1. You must output RAW, valid HTML only. 
2. Do NOT use markdown code blocks (like \`\`\`html). 
3. Do NOT use artifact syntax (like :::artifact). 
4. Do NOT use markdown for bolding or formatting (like **text**).
5. If you include textual analysis, you MUST wrap it in beautiful, modern HTML tags.
6. You MUST use Chart.js via exactly this CDN: <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
7. You MUST render charts using <canvas> tags. DO NOT use <img> tags or external image chart APIs (like QuickChart).

Only use tables and columns from this schema:
${injectedSchema}

When using the query_database_action or get_database_schema_action tools, YOU MUST pass the following connection ID as the "db_conn_id" parameter: ${databaseId}`;

    if (parentHtml) {
      promptContent += `\n\nCRITICAL INSTRUCTION FOR MODIFICATION:
The user wants to ADD more charts to their existing report.
Here is the exact HTML of their current report:
=== START EXISTING HTML ===
${parentHtml}
=== END EXISTING HTML ===

Your task is to return the FULL HTML, but with the NEW requested chart(s) appended to the layout. 
DO NOT remove or delete the existing charts. Simply add the new canvas elements and Chart.js initialization logic to the existing code.`;
    }

    // Trigger the AI report generation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);
    const agentPaths = ['/api/agents/v1/chat/completions'];
    const aiRequestBody = {
      model: 'agent_RQFKRTcGXf3a35KStB_GK',
      messages: [
        {
          role: 'system',
          content: promptContent,
        },
        {
          role: 'user',
          content: query,
        },
      ],
      stream: false,
    };

    let librechatResponse;
    let lastAgentUrl = '';

    for (const path of agentPaths) {
      lastAgentUrl = `${LIBRECHAT_URL}${path}`;
      try {
        librechatResponse = await fetch(lastAgentUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LIBRECHAT_API_KEY || process.env.OPENAI_API_KEY || token}`,
          },
          signal: controller.signal,
          body: JSON.stringify(aiRequestBody),
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error('[Generate] AI agent request failed', {
          url: lastAgentUrl,
          message: fetchError.message,
          stack: fetchError.stack,
        });
        throw new Error(`AI agent request failed: ${fetchError.message}`);
      }

      if (librechatResponse.ok) {
        break;
      }

      const responseText = await librechatResponse.text().catch(() => '<unreadable response>');
      console.warn('[Generate] AI agent returned non-ok response', {
        url: lastAgentUrl,
        status: librechatResponse.status,
        statusText: librechatResponse.statusText,
        responseText,
      });

      if (librechatResponse.status !== 404) {
        clearTimeout(timeoutId);
        throw new Error(`AI agent returned an error: ${librechatResponse.status} ${librechatResponse.statusText}`);
      }
    }

    clearTimeout(timeoutId);

    if (!librechatResponse || !librechatResponse.ok) {
      throw new Error(`AI agent returned an error: ${librechatResponse?.status || 'unknown'} ${librechatResponse?.statusText || 'No response'}`);
    }

    const aiPayload = await librechatResponse.json();
    let html_markup = aiPayload.choices?.[0]?.message?.content || '';

    // Strip out LibreChat artifact syntax and markdown code blocks just in case the AI ignores the prompt
    html_markup = html_markup.replace(/:::artifact\{[\s\S]*?\}/g, '');
    html_markup = html_markup.replace(/:::/g, '');
    const htmlMatch = html_markup.match(/```html\n([\s\S]*?)```/);
    if (htmlMatch) {
      html_markup = htmlMatch[1];
    } else {
      html_markup = html_markup.replace(/```\w*\n/g, '').replace(/```/g, '');
    }
    
    html_markup = html_markup.trim();

    let finalMarkup = html_markup;
    if (!finalMarkup.includes('<html') && !finalMarkup.includes('<div') && !finalMarkup.includes('<canvas')) {
      console.warn('[Generate] AI returned plain text instead of HTML. Wrapping in a display container.');
      finalMarkup = `
        <div style="padding: 2rem; font-family: sans-serif; color: #4A154B; text-align: center; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef; margin: 2rem;">
          <h3 style="margin-bottom: 1rem;">Message from AI Assistant</h3>
          <p style="font-size: 1.1rem; line-height: 1.5;">${html_markup.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
      `;
    }

    // Save the report to ClickHouse
    const reportId = crypto.randomUUID();
    try {
      await initializeReportsTable();
      await internalClient.insert({
        table: 'jacaranda_reports',
        values: [
          {
            id: reportId,
            user_id: session.userId,
            db_conn_id: databaseId,
            query_text: query,
            report_html: finalMarkup,
            brand_colors: JSON.stringify(brandColors || {}),
            fallback_simulated: 0,
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
          },
        ],
        format: 'JSONEachRow',
      });
    } catch (insertError: any) {
      // Log but don't fail — the report was generated successfully even if persistence fails
      console.error('[Generate] Failed to save report:', insertError);
    }

    // Extract a plain text summary from the HTML markup
    let plainTextSummary = finalMarkup
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();

    return NextResponse.json({
      success: true,
      id: reportId,
      htmlMarkup: finalMarkup,
      summary: plainTextSummary,
      fallback_simulated: false,
    });

  } catch (error: any) {
    console.error('[Generate] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
