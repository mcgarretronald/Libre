import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { internalClient } from '@/lib/clickhouse';
import { createClient } from '@clickhouse/client';
import { ObjectId } from 'mongodb';

const LIBRECHAT_URL = (process.env.LIBRECHAT_URL || 'http://localhost:3080').replace(/\/$/, '');

// Allow up to 2 minutes for schema reflection and AI generation
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// In-memory cache for database schemas to avoid repeatedly querying the target DB
const schemaCache = new Map<string, { timestamp: number; schema: any[] }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Scores and filters schema tables by keyword relevance to the user query.
// Keeps the context sent to the AI within a token budget.
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

    const { query, databaseId, brandColors } = await req.json();

    if (!databaseId) {
      return NextResponse.json({ error: 'No database selected' }, { status: 400 });
    }

    // Block any destructive SQL keywords before they reach the AI
    const normalizedQuery = query.toUpperCase();
    if (
      normalizedQuery.includes('DROP') ||
      normalizedQuery.includes('TRUNCATE') ||
      normalizedQuery.includes('ALTER') ||
      normalizedQuery.includes('DELETE')
    ) {
      return NextResponse.json({ error: 'Destructive commands are not allowed' }, { status: 403 });
    }

    // Load the target database connection for this user
    const { db } = await connectToDatabase();
    const connection = await db.collection('jacaranda_connections').findOne({
      _id: new ObjectId(databaseId),
      userId: session.userId,
    });

    if (!connection) {
      return NextResponse.json({ error: 'Database connection not found or access denied' }, { status: 404 });
    }

    // Fetch and cache the target database schema
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
    }

    const injectedSchema = filterSchema(rawSchema, query);
    console.log(`[Generate] Schema tokens used: ~${Math.ceil(injectedSchema.length / 4)}`);

    // Send the query and schema to the AI agent with a 60 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const agentPaths = ['/api/agents/v1/chat/completions'];
    const aiRequestBody = {
      model: 'agent_RQFKRTcGXf3a35KStB_GK',
      messages: [
        {
          role: 'system',
          content: `You are an expert BI engine. Produce a comprehensive multi-chart HTML layout using Chart.js.
Use these brand colors for datasets: ${JSON.stringify(brandColors || { primary: '#4A154B', secondary: '#E06A55', accent: '#1E6B65' })}.
Do not output emojis or decorative icons.
Only use tables and columns from this schema:
${injectedSchema}`,
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
    const html_markup = aiPayload.choices?.[0]?.message?.content || '';

    if (!html_markup.includes('<html') && !html_markup.includes('<div') && !html_markup.includes('<canvas')) {
      console.error('[Generate] AI returned invalid HTML. Payload:', JSON.stringify(aiPayload));
      console.error('[Generate] Extracted markup:', html_markup);
      throw new Error('AI returned invalid HTML.');
    }

    // Save the report to MongoDB
    const reportId = crypto.randomUUID();
    try {
      await internalClient.insert({
        table: 'jacaranda_reports',
        values: [
          {
            id: reportId,
            user_id: session.userId,
            db_conn_id: databaseId,
            query_text: query,
            report_html: html_markup,
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
          },
        ],
        format: 'JSONEachRow',
      });
    } catch (insertError: any) {
      // Log but don't fail — the report was generated successfully even if persistence fails
      console.error('[Generate] Failed to save report:', insertError);
    }

    return NextResponse.json({
      success: true,
      id: reportId,
      htmlMarkup: html_markup,
      fallback_simulated: false,
    });

  } catch (error: any) {
    console.error('[Generate] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
