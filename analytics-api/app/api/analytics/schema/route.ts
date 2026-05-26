import { NextResponse } from 'next/server'
import { createClient } from '@clickhouse/client'
import fs from 'fs'

// ClickHouse Client Setup
const getClickhouseHost = (): string => {
    const rawHost = process.env.CLICKHOUSE_HOST || 'http://localhost:8123'
    let isDocker = false
    try {
        isDocker = fs.existsSync('/.dockerenv')
    } catch { }

    // Auto-resolve Docker host for local dev
    if (!isDocker && rawHost.includes('://clickhouse')) {
        return rawHost.replace('://clickhouse', '://127.0.0.1')
    }
    return rawHost
}

const clickhouse = createClient({
    url: getClickhouseHost(),
    username: process.env.CLICKHOUSE_USER || 'nextjs_llm_user',
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DATABASE || 'default',
})

// API Endpoints

// Retrieve Database Schema for LLM context
export async function GET(req: Request) {
    try {
        // 1. Fetch raw column metadata
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

        // 2. Group columns by table
        const tableMap: Record<string, Array<{ name: string; type: string }>> = {}
        rawColumns.forEach((row) => {
            if (!tableMap[row.table]) tableMap[row.table] = []
            tableMap[row.table].push({ name: row.name, type: row.type })
        })

        // 3. Format response array
        const formattedTables = Object.keys(tableMap).map((tableName) => ({
            table: tableName,
            columns: tableMap[tableName],
        }))

        return NextResponse.json({ tables: formattedTables })
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to extract database metadata', details: error.message }, { status: 500 })
    }
}
