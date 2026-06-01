# Jacaranda Health Operations Analytics Portal

A production-grade, highly secure Natural Language Query (NLQ) analytics stack integrating **LibreChat/OpenAI** with a local **ClickHouse** Analytics Database via a custom **Next.js Web Portal** and **Node.js Background Cron Worker**.

---

## 🏗️ Cloud Architecture Flow

This flowchart illustrates the complete production lifecycle of a user query, from natural language prompt to interactive dashboard and automated email report dispatch.

```mermaid
flowchart TD
    User([End User]) -->|1. Natural Language Question| WebPortal[Next.js Portal Web UI]
    WebPortal -->|2. Secure API Request| BFF[Next.js BFF API Routes]
    
    subgraph Secure Backend Integration
        BFF -->|3. Fetch Real Data (Read-Only)| ClickHouse[(ClickHouse Analytics DB)]
        BFF -->|4. Generate Chart HTML| OpenAI[OpenAI API / LibreChat]
        BFF -->|5. Store Campaign/Schedules| MongoDB[(MongoDB Atlas)]
    end
    
    ClickHouse -->|6. Raw Data| BFF
    OpenAI -->|7. High-Fidelity Chart HTML| BFF
    
    BFF -->|8. Server-Side Sanitization| WebPortal
    WebPortal -->|9. Renders Interactive UI Iframe| User
    
    User -->|10. Dispatch Campaign (CSV/Manual)| CronWorker[Node.js Cron Worker Docker Service]
    
    subgraph Automated Dispatch Pipeline
        CronWorker -->|11. Wake on Schedule| MongoDB
        CronWorker -->|12. Puppeteer Export (Optional PDF)| HeadlessBrowser[System Chromium Alpine]
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

### 3. Asynchronous Cron Scheduling
The architecture strictly separates the frontend web server (`portal-web`) from the background task processor (`portal-cron`). 
- **Immediate Dispatches:** Triggers a webhook (`/api/analytics/campaigns`) to send emails instantly without blocking the UI thread.
- **Scheduled Dispatches:** Uses `node-cron` to parse custom cron expressions and dispatch reports automatically from the detached worker.

### 4. Headless PDF Generation Engine & Email Templates
The system sends highly professional HTML email briefs summarizing the data insights. When necessary, it utilizes a native Chromium installation inside an Alpine Docker container to capture high-fidelity PDF snapshots of the AI-generated interactive charts via Puppeteer.

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

## 🛠️ Docker Deployment Guide

The entire stack is configured via `docker-compose.yml` for seamless, single-command deployment.

### Step 1: Environment Configuration
Create a `.env` file at the root of the project with the following keys:
```ini
# Core Configuration
MONGO_URI=mongodb://localhost:27017/librechat
OPENAI_API_KEY=sk-proj-...

# SMTP Configuration (For Email Dispatch)
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

### Step 2: Spin Up the Stack
Run the following command to build and start the infrastructure:
```bash
docker compose up -d --build
```
This deploys the interconnected services:
1. `portal-web`: The primary Next.js analytical UI gateway (Port `3000`).
2. `portal-cron`: The Node.js headless background job worker for campaign dispatch.
3. `librechat`: The core conversational engine (if enabled).
