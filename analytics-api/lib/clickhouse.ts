import { createClient } from '@clickhouse/client';

// ClickHouse client for the internal Jacaranda reporting database.
// All credentials must be provided via environment variables.
export const internalClient = createClient({
  url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'default',
});

// Creates the reports table if it does not already exist
export async function initializeReportsTable() {
  try {
    await internalClient.query({
      query: `
        CREATE TABLE IF NOT EXISTS jacaranda_reports (
          id           UUID DEFAULT generateUUIDv4(),
          user_id      String,
          db_conn_id   String,
          query_text   String,
          report_html  String,
          created_at   DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (user_id, created_at)
      `,
      format: 'JSONEachRow',
    });
    console.log('[ClickHouse] jacaranda_reports table ready.');
  } catch (error) {
    console.error('[ClickHouse] Failed to initialize table:', error);
  }
}
