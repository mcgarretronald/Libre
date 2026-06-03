import { createClient } from '@clickhouse/client';

// Internal analytics database connection
export const internalClient = createClient({
  url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'default',
});

// Ensure internal reports schema exists
export async function initializeReportsTable() {
  try {
    await internalClient.query({
      query: `
        CREATE TABLE IF NOT EXISTS jacaranda_reports (
          id                 String,
          user_id            String,
          db_conn_id         String,
          query_text         String,
          report_html        String,
          brand_colors       String,
          fallback_simulated UInt8 DEFAULT 0,
          created_at         DateTime DEFAULT now()
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
