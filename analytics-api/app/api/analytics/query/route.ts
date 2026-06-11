import { createClient } from '@clickhouse/client'
import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { ObjectId } from 'mongodb'
import fs from 'fs'
import { error } from 'console'

// Default ClickHouse Client Setup (Fallback)
// const getClickhouseHost = (): string => {
//     const rawHost = process.env.CLICKHOUSE_HOST || 'http://localhost:8123'
//     let isDocker = false
//     try {
//         isDocker = fs.existsSync('/.dockerenv')
//     } catch { }

//     if (!isDocker && rawHost.includes('://clickhouse')) {
//         return rawHost.replace('://clickhouse', '://127.0.0.1')
//     }
//     return rawHost
// }

const buildClickHouseUrl = (host: string, port?: string | number) => {
    const normalizedHost = host.startsWith('http') ? host : `https://${host}`;
    const url = new URL(normalizedHost);
    if (port && !url.port) url.port = String(port);
    return url.toString().replace(/\/+$/, '');
};

async function getClientForRequest(dbConnId: string | undefined | null) {
    if (dbConnId) {
        const { db } = await connectToDatabase();
        let connection = null;
        try {
            connection = await db.collection('jacaranda_connections').findOne({ _id: new ObjectId(dbConnId) });
        } catch (e) {
            console.error('Invalid dbConnId ObjectId:', dbConnId);
        }
        if (connection) {
            return createClient({
                url: buildClickHouseUrl(connection.host, connection.port),
                username: connection.username,
                password: decrypt(connection.password),
                database: connection.databaseName,
                request_timeout: 60000,
            });
        }
    }

    // Fallback to default
    return 
    // TODO : Ensure to retun a fall back message 
}

// Security & Validation Rules
const FORBIDDEN_KEYWORDS = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP',
    'ALTER', 'TRUNCATE', 'CREATE', 'REPLACE',
    'ATTACH', 'DETACH', 'RENAME', 'SYSTEM',
]

// Block dangerous table functions
const FORBIDDEN_FUNCTIONS = [
    'url', 'file', 'mysql', 'postgresql', 'mongodb', 's3', 'remote', 'executable'
]


// Validate SQL Query  
function validateSQL(sql: string): { ok: boolean; reason?: string } {
    const cleanSql = sql.trim()
    const upper = cleanSql.toUpperCase()

    // Enforce read-only operations
    if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
        return { ok: false, reason: 'Only SELECT and WITH queries are allowed.' }
    }

    // Block forbidden write/DDL keywords
    for (const keyword of FORBIDDEN_KEYWORDS) {
        const pattern = new RegExp(`\\b${keyword}\\b`, 'i')
        if (pattern.test(upper)) {
            return { ok: false, reason: `Keyword "${keyword}" is not allowed.` }
        }
    }

    const systemDbPattern = /\b['"`]?system['"`]?\s*\./i
    const informationSchemaPattern = /\b['"`]?information_schema['"`]?\s*\./i
    if (systemDbPattern.test(upper) || informationSchemaPattern.test(upper)) {
        return { ok: false, reason: 'Access to system tables is not allowed.' }
    }

    for (const fn of FORBIDDEN_FUNCTIONS) {
        const pattern = new RegExp(`\\b${fn}\\s*\\(`, 'i')
        if (pattern.test(upper)) {
            return { ok: false, reason: `Use of table function "${fn}()" is forbidden.` }
        }
    }

    if (upper.includes(';')) {
        const statements = cleanSql.split(';').filter(s => s.trim().length > 0)
        if (statements.length > 1) {
            return { ok: false, reason: 'Multiple statements are not allowed.' }
        }
    }

    return { ok: true }
}


// API Endpoints

// Health check
export async function GET() {
    return NextResponse.json({
        status: 'online',
        message: 'Analytics API is running. Send a POST request with a SQL query in the JSON body and Authorization headers to execute queries.',
        endpoint: '/api/analytics/query',
        methods_supported: ['POST'],
    })
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const sql = body.sql || body.query
        const dbConnId = body.db_conn_id || body.connection_id || body.databaseId;

        if (!sql || typeof sql !== 'string') {
            return NextResponse.json({ error: 'No SQL provided. Please provide a "sql" or "query" parameter.' }, { status: 200 })
        }

        // 1. Validate SQL
        const check = validateSQL(sql)
        if (!check.ok) {
            return NextResponse.json({ error: check.reason }, { status: 200 })
        }

        // 2. Enforce safe row limits (max 5000)
        let safeSql = sql.trim()
        const limitMatch = safeSql.match(/\bLIMIT\s+(\d+)\b/i)
        if (limitMatch) {
            const currentLimit = parseInt(limitMatch[1], 10)
            if (currentLimit > 5000) {
                safeSql = safeSql.replace(/\bLIMIT\s+\d+/i, 'LIMIT 5000')
            }
        } else {
            safeSql = `${safeSql} LIMIT 100`
        }

        const clickhouse = await getClientForRequest(dbConnId);
        
        if (!clickhouse) {
            return NextResponse.json({ error: 'Database connection not found or invalid dbConnId provided.' }, { status: 200 })
        }

        const result = await clickhouse.query({
            query: safeSql,
            format: 'JSONEachRow',
        })

        const dataset = await result.json() as any[]
        
        await clickhouse.close();

        return NextResponse.json({
            meta: [],
            data: dataset,
            rows: dataset.length
        })

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        // Return 200 OK with error payload so LibreChat's agent can read the SQL error and self-heal.
        // If we return 500 or 400, Axios throws an exception and the agent only sees "Request failed with status code 500"
        return NextResponse.json({ error: 'Query execution failure', details: message }, { status: 200 })
    }
}