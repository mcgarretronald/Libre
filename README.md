# Enterprise AI Analytics Stack

A production-grade, highly secure Natural Language Query (NLQ) analytics stack integrating **LibreChat** with **ClickHouse Cloud** via a **Vercel-hosted Next.js API Gateway**.

---

## Cloud Architecture Flow

This flowchart illustrates the complete production lifecycle of a user query, from natural language prompt to safe data retrieval, using fully managed cloud services:

```mermaid
flowchart TD
    User([End User]) -->|1. Natural Language Question| LibreChat[LibreChat App UI\nRailway / Render / VPS]
    LibreChat -->|2. Stores Session/User Info| MongoDB[(MongoDB Atlas\nCloud Database)]
    
    subgraph Secure Gateway Layer
        LibreChat -->|3. Tool Call: run_analytics_query| Vercel[Next.js API Gateway\n Vercel Serverless]
        Vercel -->|4. Strict SQL Safety & Limits Parsing| SafeSQL{Is Query Safe?}
    end
    
    SafeSQL -->|Yes| ClickHouse[(ClickHouse Cloud\nShared Analytics Cluster)]
    SafeSQL -->|No: Abort query| Vercel
    
    ClickHouse -->|5. Returns Read-Only Datasets| Vercel
    Vercel -->|6. Formats clean Markdown Tables| LibreChat
    LibreChat -->|7. Beautiful Business Readout| User

```

---

##  Quick Cloud Deployment Guide

Follow these direct steps to host the entire stack publicly.

### Step 1: Spin up ClickHouse Cloud
1. Create a service on [ClickHouse Cloud](https://clickhouse.com/cloud).
2. Open the ClickHouse SQL Console and seed your tables (`cell_towers`) with standard SQL scripts.
3. Keep your cluster connection strings secure.

### Step 2: Deploy API Gateway to Vercel
*Your Next.js secure gateway is already deployed at:* **`https://analytics-api-rvbl.vercel.app`**
1. Add the following **Environment Variables** in your Vercel Dashboard:
   - `CLICKHOUSE_HOST`: `https://your-cloud-host.clickhouse.cloud:8443`
   - `CLICKHOUSE_USER`: `default`
   - `CLICKHOUSE_PASSWORD`: `your_cloud_password`
   - `CLICKHOUSE_DATABASE`: `default`
   - `RESEND_API_KEY`: `your_resend_api_key` (Required for PDF email reporting)

> [!NOTE]
> By default, the PDF report dispatch service uses the Resend sandbox address `onboarding@resend.dev`. Outbound emails will strictly be sent to the verified Resend account owner. If you wish to send PDF reports to arbitrary third-party public email addresses, verify your custom domain in the Resend dashboard and update the `from` sender domain in the route code accordingly.

### Step 3: Spin up MongoDB Atlas
1. Create a free M0 cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Set the Network Access rule to `0.0.0.0/0` (Allow access from anywhere).
3. Copy your MongoDB SRV Connection String.

### Step 4: Host LibreChat (Railway, Render, or VPS)
1. Deploy LibreChat using the official Docker image `ghcr.io/danny-avila/librechat:latest`.
2. Map port `3080` to the web.
3. Inject the production environment variables (shown below).

---

## Production Environment Variables (`.env`)

Configure these keys inside your LibreChat hosting dashboard settings:

```ini

HOST=0.0.0.0
PORT=3080
ALLOW_REGISTRATION=true
ENDPOINTS=openAI,agents

MONGO_URI=mongodb+srv://admin_user:yourSecurePassword@cluster.mongodb.net/LibreChat?retryWrites=true&w=majority

# ClickHouse Cloud Analytics Database
CLICKHOUSE_HOST=https://your-cloud-host.clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your_clickhouse_password
CLICKHOUSE_DATABASE=default

JWT_SECRET=4fb03ffec291244abeb4a9b6c0065ad7bdc98a3e7428807d995c760cdbf6011d
JWT_REFRESH_SECRET=7f5df5ccb57d60f58eb808c160b7ca67b3fb5ea6da95e929f957018ad5a34f8a

# Credentials encryption keys
CREDS_KEY=f5efab41ef7da0119a0a030eb9e3d9319e7428807d995c760cdbf6011dd5d7b5b
CREDS_IV=e57efab41ef7da0119a0a030eb9e3d

# Third-party integrations
OPENAI_API_KEY=sk-proj-yourActualOpenAiApiKey...
RESEND_API_KEY=re_yourResendApiKey...
```

## OpenAPI Actions Tool Schema

To configure the tools/actions for your LibreChat LLM Agent, copy the following OpenAPI 3.0 specification and paste it into the **Actions** configuration panel of the Agent Builder interface:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "ClickHouse Analytics API",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://libre-analysis.vercel.app"
    }
  ],
  "paths": {
    "/api/analytics/query": {
      "post": {
        "operationId": "run_analytics_query",
        "summary": "Executes analytical SQL query on ClickHouse",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "query": {
                    "type": "string"
                  }
                },
                "required": [
                  "query"
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Success"
          }
        }
      }
    },
    "/api/analytics/schema": {
      "get": {
        "operationId": "get_database_schema",
        "summary": "Fetches current database table maps and columns",
        "responses": {
          "200": {
            "description": "Success"
          }
        }
      }
    },
    "/api/analytics/email-report": {
      "post": {
        "operationId": "email_analytics_report",
        "summary": "Generates a branded PDF report and emails it to the specified recipient",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "recipient_email": {
                    "type": "string",
                    "format": "email"
                  },
                  "query_used": {
                    "type": "string"
                  },
                  "brand_context": {
                    "type": "object",
                    "properties": {
                      "primary": {
                        "type": "string"
                      },
                      "secondary": {
                        "type": "string"
                      },
                      "name": {
                        "type": "string"
                      }
                    }
                  }
                },
                "required": [
                  "recipient_email",
                  "query_used"
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Success"
          }
        }
      }
    }
  }
}
```

---

##  LLM Agent System Prompt Integration

To configure your LibreChat LLM Agent, copy and paste these optimized instructions directly into its **System Prompt / Instructions** panel. This ensures 100% compliance with Clickhouse SQL formats and safety thresholds:

```text
You are an elite ClickHouse Data Analytics Assistant operating over a production analytical cluster. Your core mandate is to interpret natural language questions, dynamically discover schema structures, and execute highly optimized, read-only SQL queries to deliver premium, client-ready business readouts.

### CORE OPERATING PROTOCOL
1. SCHEMA DISCOVERY FIRST: When a user asks an analytical question, you must FIRST invoke the 'get_database_schema' tool to inspect active table names, column layouts, and data types. Never guess the database layout or rely on pre-existing assumptions.
2. QUERY EMISSION: Once you have dynamically validated the schema map via the tool output, construct a single, highly optimized SELECT or WITH statement matching the exact table and column identifiers found.
3. EXECUTION: Pass that clean, raw query string into the 'run_analytics_query' tool to retrieve live data.
4. SELF-HEALING TRIAL: If a query returns a syntax, type, or database error, analyze the error message, correct the SQL query immediately, and execute the corrected query. Do not report failures to the user without attempting to self-heal first.

### CRITICAL SECURITY & EXECUTION RULES
1. STRICT READ-ONLY LAYER: You are strictly restricted to SELECT or WITH statements. Any commands attempting data mutation, structural manipulation, or deletion (e.g., INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE) are strictly forbidden.
2. NO SYSTEM ACCESS: Never attempt to query internal or operational logs (e.g., tables under the 'system.*' database engine or 'information_schema.*').
3. ABSOLUTE ARGUMENT CLEANLINESS: When invoking 'run_analytics_query', pass the raw SQL string directly in the query argument. Do NOT wrap the query argument in markdown formatting block decorators (such as ```sql ... ```).
4. THE DEFENSIVE LIMIT CEILING: If a user asks for granular lines of raw data, individual item lists, or specific transaction/data logs, you must append an explicit LIMIT clause (default to LIMIT 100, hard capped at LIMIT 5000) to protect downstream memory buffers.

### CLICKHOUSE SYNTAX, ALIASING & TYPE RULES
1. NO SINGLE QUOTES FOR ALIASES: NEVER use single quotes (') for column aliases or identifiers. In ClickHouse, single quotes strictly represent string literals (text values).
2. VALID IDENTIFIERS: For column aliases, always use standard snake_case without spaces (e.g., total_towers or avg_signal). If an alias must contain spaces or special characters, wrap it strictly in backticks (`) or double quotes (").
   - WRONG: SELECT count(*) AS 'Total Towers' ...
   - CORRECT: SELECT count(*) AS total_towers ... OR SELECT count(*) AS `Total Towers` ...
3. DATE & TIME CONVERSIONS: Use native ClickHouse date/time functions for aggregation and filtering:
   - To group by month: `toStartOfMonth(created_at)` or `formatDateTime(created_at, '%Y-%m')`
   - To format timestamp: `formatDateTime(created_at, '%Y-%m-%d %H:%i:%s')`
4. ENUM COLUMN FILTERING: When filtering on ClickHouse Enum columns (e.g. `Enum8` or `Enum16`), filter using the string value representation directly (e.g. `radio = 'LTE'` rather than its index representation).
5. DECIMAL WRAPPING: Round financial decimal aggregation outputs explicitly using `round(value, 2)` or `toDecimal64(value, 2)` to guarantee consistent precision.
6. NO MULTIPLE SEMICOLONS: Standard queries should end without semicolons, or with a single terminal semicolon at most. Multiple semicolon statements are blocked.

### UI RENDERING & BUSINESS REVIEWS
- GRID REPRESENTATION: Always present data returned from execution outputs as clean, fully structured GitHub-flavored Markdown tables. Do not dump raw JSON arrays onto the UI interface.
- BUSINESS CASING: Use Title Case formatting for column names inside the final Markdown table output to present high-quality business readouts (e.g., write "Total Revenue" instead of "SUM(revenue)" or "total_revenue").
- CURRENCY METRICS: For any clearly financial or revenue-based numerical columns returned, append the absolute dollar symbol ($) and guarantee fields are rounded accurately to two decimal points.
- PAGINATION PROMPTS: If the data payload response length exactly equals the LIMIT value set inside your query, add a distinct footnote at the base of the table: "Showing the first X records. To see the next batch, reply with 'Show next page'."
- STATEFUL PAGINATION: When handling a pagination request, replicate the baseline query sequence while integrating an incremental OFFSET modifier relative to the previous layout count (e.g., LIMIT 100 OFFSET 100).
```
