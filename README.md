# Jacaranda Health Operations Analytics Portal

A production-grade, highly secure Natural Language Query (NLQ) analytics stack integrating **LibreChat/OpenAI** with a local **ClickHouse** Analytics Database via a custom **Next.js Web Portal** and **Node.js Background Cron Worker**.

---

## 🏗️ Cloud Architecture Flow

This flowchart illustrates the complete production lifecycle of a user query, from natural language prompt to interactive dashboard and automated email report dispatch.

```mermaid
flowchart TD
    User([End User]) -->|1. Natural Language Question| WebPortal[Next.js Portal Web UI (Vercel)]
    WebPortal -->|2. Secure API Request| BFF[Next.js BFF API Routes (Vercel)]
    
    subgraph Secure Backend Integration
        BFF -->|3. Fetch Real Data (Read-Only)| ClickHouse[(ClickHouse Analytics DB)]
        BFF -->|4. Generate Chart HTML| OpenAI[OpenAI API / LibreChat]
        BFF -->|5. Store Campaign/Schedules| MongoDB[(MongoDB Atlas)]
    end
    
    ClickHouse -->|6. Raw Data| BFF
    OpenAI -->|7. High-Fidelity Chart HTML| BFF
    
    BFF -->|8. Server-Side Sanitization| WebPortal
    WebPortal -->|9. Renders Interactive UI Iframe| User
    
    User -->|10. Dispatch Campaign (UI)| WebPortal
    
    subgraph Automated Dispatch Pipeline (Render)
        CronWorker[Node.js Cron Worker Docker Service] -->|11. Real-time Change Streams| MongoDB
        CronWorker -->|12. Fetch PDF Payload| ServerlessChromium[Serverless Chromium-Min API]
        CronWorker -->|13. Build Professional Template| EmailDispatcher[Nodemailer SMTP]
    end
    
    EmailDispatcher -->|14. Secure TLS Email Dispatch| Recipients([Target Stakeholders])
```

---

## 🚀 Key Features

### 1. Interactive AI-Generated Dashboards
The Next.js Portal acts as a secure gateway that routes user prompts to the AI backend. Instead of returning raw tables, it compiles self-contained, interactive `Chart.js` HTML visualizations. Broad queries automatically generate comprehensive CSS Grid dashboards (mixing KPIs, bar, pie, and line charts), while specific queries return focused charts.

### 2. Campaign Target Lists & CSV Uploads
The Campaign Dispatch mechanism allows operators to:
- Instantly type and add target email addresses manually.
- Upload bulk CSV distribution lists dynamically.
- Manage active and archived automated reporting schedules via a modern SaaS interface.

### 3. Real-Time Distributed Architecture
The architecture strictly separates the user-facing web server from the background task processor, optimized for serverless deployments.
- **Vercel (Frontend & API):** Handles UI rendering and API requests.
- **Render (Cron Worker):** A persistent background Docker container that monitors the database.
- **MongoDB Change Streams:** Replaces outdated HTTP webhooks and crude polling. The worker uses MongoDB replica set Change Streams to instantly react to campaigns queued from the Vercel dashboard.

### 4. Serverless PDF Generation Engine
To bypass strict serverless function limits (like Vercel's 50MB Hobby tier limit), the PDF generation pipeline utilizes `@sparticuz/chromium-min`. The Chromium binary is fetched remotely at runtime, allowing the platform to capture high-fidelity PDF snapshots of the AI-generated interactive charts without bloating the deployment size.

### 5. LibreChat OpenAPI Integration
The platform exposes an OpenAPI specification (`openapi.json`) that allows LibreChat Custom Actions and Agents to autonomously interact with the analytics API. 
*Note: Ensure the `servers` URL in the LibreChat plugin configuration points strictly to your production Vercel deployment URL to ensure successful AI routing.*

---

## 🔒 Security & Hardening Features

This stack was explicitly designed to mitigate common vulnerabilities found in older JS stacks and LLM integrations:

- **BFF Isolation Layer:** The frontend never connects directly to the database or LLM. All secrets and keys are securely kept in server-side `.env` variables.
- **Prompt Injection Defense:** Strict, system-level `FATAL` prompt guardrails ensure the AI only outputs safe visualization code.
- **Server-Side Sanitization:** An explicit backend regex sanitizer actively strips out unauthorized badges, headers, or injected content before the HTML ever reaches the user.
- **Iframe Sandboxing:** Rendered AI charts are placed inside isolated `srcDoc` iframes, eliminating cross-site scripting (XSS) risks to the main application window.
- **No Dangerous JS Engines:** Eliminates `eval()` and older hacker-susceptible template engines. Built on modern Next.js React Server Components.
- **Read-Only Data Access:** The ClickHouse connection strictly runs analytics queries, neutralizing destructive SQL Injection (SQLi) vectors.

---

## 🛠️ Deployment Guide

### Environment Configuration
Ensure your `.env` variables are configured across both your Vercel and Render deployments:
```ini
# Core Configuration
APP_URL=https://libre-analysis.vercel.app
MONGO_URI=mongodb+srv://.../librechat
OPENAI_API_KEY=sk-proj-...

# SMTP Configuration (For Email Dispatch - Render Worker)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# ClickHouse Analytics Database
CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-clickhouse-password
CLICKHOUSE_DATABASE=default
```

### Vercel (Frontend & API)
Deploy the Next.js application to Vercel. Ensure `maxDuration` overrides are removed for Hobby tier compliance.

### Render (LibreChat & Cron Worker)
The backend worker is bundled securely with LibreChat via `Dockerfile.libre`:
```dockerfile
# Starts LibreChat Backend and Cron Worker simultaneously
CMD ["sh", "-c", "node /app/cron/cron-worker.js & npm run backend"]
```
Ensure Render's build configuration uses `Dockerfile.libre` as the target Dockerfile to correctly spawn the worker process.
