import { NextResponse } from 'next/server'
import { createClient } from '@clickhouse/client'
import { connectToDatabase } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { ObjectId } from 'mongodb'
import fs from 'fs'

// Default ClickHouse Client Setup (Fallback)
const getClickhouseHost = (): string => {
    const rawHost = process.env.CLICKHOUSE_HOST || 'http://localhost:8123'
    let isDocker = false
    try {
        isDocker = fs.existsSync('/.dockerenv')
    } catch { }

    if (!isDocker && rawHost.includes('://clickhouse')) {
        return rawHost.replace('://clickhouse', '://127.0.0.1')
    }
    return rawHost
}

const buildClickHouseUrl = (host: string, port?: string | number) => {
    const normalizedHost = host.startsWith('http') ? host : `https://${host}`;
    const url = new URL(normalizedHost);
    if (port && !url.port) url.port = String(port);
    return url.toString().replace(/\/+$/, '');
};

async function getClientForRequest(req: Request) {
    let dbConnId = null;

    if (req.method === 'POST') {
        try {
            const body = await req.clone().json();
            dbConnId = body.db_conn_id || body.connection_id || body.databaseId;
        } catch { }
    } else {
        const { searchParams } = new URL(req.url);
        dbConnId = searchParams.get('db_conn_id') || searchParams.get('connection_id') || searchParams.get('databaseId');
    }

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
    return createClient({
        url: getClickhouseHost(),
        username: process.env.CLICKHOUSE_USER || 'nextjs_llm_user',
        password: process.env.CLICKHOUSE_PASSWORD,
        database: process.env.CLICKHOUSE_DATABASE || 'default',
    });
}

// Retrieve Database Schema for LLM context
export async function GET(req: Request) {
    return handleSchemaRequest(req);
}

export async function POST(req: Request) {
    return handleSchemaRequest(req);
}

async function handleSchemaRequest(req: Request) {
    try {
        const clickhouse = await getClientForRequest(req);
        
        const resultSet = await clickhouse.query({
            query: `
                SELECT table, name, type 
                FROM system.columns 
                WHERE database = currentDatabase()
                ORDER BY table, position;
            `,
            format: 'JSONEachRow',
        })

        const rawColumns = await resultSet.json() as Array<{ table: string; name: string; type: string }>

        const tableMap: Record<string, Array<{ name: string; type: string }>> = {}
        rawColumns.forEach((row) => {
            if (!tableMap[row.table]) tableMap[row.table] = []
            tableMap[row.table].push({ name: row.name, type: row.type })
        })

        const formattedTables = Object.keys(tableMap).map((tableName) => ({
            table: tableName,
            columns: tableMap[tableName],
        }))

        await clickhouse.close();

        return NextResponse.json({ tables: formattedTables })
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to extract database metadata', details: error.message }, { status: 500 })
    }
}
