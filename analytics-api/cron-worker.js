const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const http = require('http');
const https = require('https');
const { createClient } = require('@clickhouse/client');

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'default',
});

// The PDF export route lives on Vercel
const APP_URL = process.env.APP_URL?.includes('vercel.app') 
  ? process.env.APP_URL 
  : 'https://libre-analysis.vercel.app';

// Store active cron tasks to allow for dynamic stopping
const activeTasks = new Map();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/librechat';

// Configure the SMTP client for email dispatch
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

// Download the PDF from the provided URL and return a Buffer
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`PDF export returned HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Dispatch the campaign email to all active recipients
async function dispatchCampaign(db, campaign, transporter) {
  console.log(`[Cron] Dispatching campaign ${campaign.campaignId}`);
  console.log(`[Cron] Recipients: ${campaign.recipients.length}, mode: ${campaign.scheduleType || 'immediate'}`);

  let report = null;
  try {
    const chResult = await clickhouse.query({
      query: `SELECT id, query_text as query FROM jacaranda_reports WHERE id = '${campaign.reportId}'`,
      format: 'JSONEachRow'
    });
    const chRows = await chResult.json();
    report = chRows.length > 0 ? chRows[0] : null;
  } catch (err) {
    console.warn(`[Cron] Warning: Failed to fetch report metadata from ClickHouse: ${err.message}`);
    // Provide fallback report object so the email still sends
    report = { id: campaign.reportId, query: 'Analytics Report' };
  }

  const reportTitle = (report?.query?.length > 60 ? report.query.substring(0, 60) + '...' : report?.query) || 'Analytics Report';
  console.log(`[Cron] Report: "${reportTitle}"`);

  // Download the PDF report attachment
  let pdfBuffer = null;
  const pdfFilename = `jacaranda-report-${String(campaign.reportId).slice(-6).toUpperCase()}.pdf`;

  if (report?.id) {
    const exportUrl = `${APP_URL}/api/analytics/export/${report.id}?format=pdf`;
    console.log(`[Cron] Fetching PDF from: ${exportUrl}`);
    try {
      pdfBuffer = await fetchBuffer(exportUrl);
      console.log(`[Cron] PDF fetched, size: ${pdfBuffer.length} bytes`);
    } catch (pdfErr) {
      console.warn(`[Cron] PDF fetch failed, sending email without attachment:`, pdfErr.message);
    }
  }

  let successCount = 0;
  let failCount = 0;

  for (const recipient of campaign.recipients) {
    console.log(`[Cron] Sending to ${recipient.email}`);

    // Remove markdown characters for plain text emails
    const summary = (report?.summary || 'No summary available.')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1');

    const greeting = recipient.name ? `Hello ${recipient.name},` : 'Hello,';

    let plainText = '';
    
    // Use the custom body if provided in the composer
    if (campaign.body) {
      plainText = [
        greeting,
        '',
        campaign.body,
        '',
        '---',
        'Automated dispatch from Jacaranda Analytics.',
        'To unsubscribe, reply with "UNSUBSCRIBE" in the subject.',
      ].join('\n');
    } else {
      // Fallback message for older campaigns
      plainText = [
        greeting,
        '',
        'Please find your Jacaranda Health analytics report attached as a PDF.',
        '',
        `Report: ${reportTitle}`,
        '',
        summary,
        '',
        '---',
        'Automated dispatch from Jacaranda Analytics.',
        'To unsubscribe, reply with "UNSUBSCRIBE" in the subject.',
      ].join('\n');
    }

    const finalSubject = campaign.subject || `${reportTitle} — Jacaranda Analytics Report`;

    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    try {
      console.log(`[Cron] Transport configuration: HOST=${process.env.SMTP_HOST} PORT=${process.env.SMTP_PORT} USER=${process.env.SMTP_USER ? 'SET' : 'MISSING'}`);
      console.log(`[Cron] Payload -> To: ${recipient.email} | Subject: ${finalSubject} | Body Length: ${plainText.length}`);
      
      const info = await transporter.sendMail({
        from: `"Jacaranda Analytics" <${process.env.SMTP_USER}>`,
        to: recipient.email,
        subject: finalSubject,
        text: plainText,
        html: undefined,
        attachments,
      });
      console.log(`[Cron] SUCCESS: Sent to ${recipient.email}, message ID: ${info.messageId}`);
      successCount++;
    } catch (err) {
      console.error(`[Cron] ERROR: Failed to send to ${recipient.email}:`, err.message);
      if (err.response) console.error(`[Cron] SMTP Response:`, err.response);
      failCount++;
    }
  }

  // Record campaign execution stats
  await db.collection('jacaranda_campaigns').updateOne(
    { campaignId: campaign.campaignId },
    {
      $set: {
        lastRunAt: new Date().toISOString(),
        lastRunStats: { successCount, failCount },
      },
    }
  );

  console.log(`[Cron] Campaign ${campaign.campaignId} done: ${successCount} sent, ${failCount} failed`);
}

// Validate and register a cron job for the given campaign
function registerTask(campaign, db, transporter) {
  if (!cron.validate(campaign.cronExpression)) {
    console.error(`[Cron] Invalid cron expression for campaign ${campaign.campaignId}: "${campaign.cronExpression}"`);
    return;
  }

  console.log(`[Cron] Scheduling campaign ${campaign.campaignId} on: "${campaign.cronExpression}"`);

  const task = cron.schedule(campaign.cronExpression, async () => {
    try {
      await dispatchCampaign(db, campaign, transporter);
    } catch (err) {
      console.error(`[Cron] Dispatch error for ${campaign.campaignId}:`, err.message);
    }
  });

  activeTasks.set(campaign.campaignId, task);
}

// Initialize MongoDB, register active campaigns, and start the control API
async function processScheduledCampaigns() {
  console.log('[Cron] Polling MongoDB for active campaigns...');
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db('LibreChat');
    const campaigns = await db.collection('jacaranda_campaigns').find({ status: 'scheduled' }).toArray();

    if (campaigns.length === 0) {
      console.log('[Cron] No scheduled campaigns found.');
    } else {
      console.log(`[Cron] Found ${campaigns.length} campaign(s), registering jobs...`);
    }

    const transporter = createTransporter();

    try {
      await transporter.verify();
      console.log('[Cron] SMTP connection verified');
    } catch (smtpErr) {
      console.error('[Cron] SMTP connection failed. Check SMTP_USER and SMTP_PASSWORD:', smtpErr.message);
    }

    campaigns.forEach((campaign) => {
      registerTask(campaign, db, transporter);
    });

    // Control API: Start, stop, or immediately trigger campaigns
    const server = http.createServer((req, res) => {

      // Handle STOP request
      if (req.method === 'DELETE' && req.url.startsWith('/kill/')) {
        const campaignId = req.url.replace('/kill/', '');
        const task = activeTasks.get(campaignId);
        if (task) {
          task.stop();
          activeTasks.delete(campaignId);
          console.log(`[Cron] Stopped campaign: ${campaignId}`);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: `Stopped task ${campaignId}` }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Task not found in memory' }));
        }
      }

      // Handle START request for a new schedule
      else if (req.method === 'POST' && req.url.startsWith('/start/')) {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const campaign = JSON.parse(body);
            registerTask(campaign, db, transporter);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Bad payload' }));
          }
        });
      }

      // Handle IMMEDIATE dispatch request
      else if (req.method === 'POST' && req.url.startsWith('/dispatch-immediate/')) {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
          try {
            const campaign = JSON.parse(body);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
            // Run dispatch after responding so the caller doesn't wait
            await dispatchCampaign(db, campaign, transporter);
          } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Bad payload' }));
          }
        });
      }

      else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(4000, '0.0.0.0', () => {
      console.log('[Cron] HTTP control server running on port 4000');
    });

    // ---------------------------------------------------------
    // Scalable Real-time Sync via Change Streams
    // ---------------------------------------------------------
    // We try to use MongoDB Change Streams first (push-based, 0 polling overhead).
    // If the database is a standalone instance without replica sets enabled,
    // we gracefully fall back to a lightweight polling mechanism.

    const syncCampaigns = async () => {
      try {
        const immediateCampaigns = await db.collection('jacaranda_campaigns').find({
          $or: [
            { status: 'dispatched', lastRunAt: { $exists: false } },
            { status: 'redispatch_pending' }
          ]
        }).toArray();

        for (const campaign of immediateCampaigns) {
          if (campaign.status === 'redispatch_pending') {
            await db.collection('jacaranda_campaigns').updateOne(
              { campaignId: campaign.campaignId },
              { $set: { status: 'dispatched' } }
            );
          }
          await dispatchCampaign(db, campaign, transporter);
        }

        const scheduledCampaigns = await db.collection('jacaranda_campaigns').find({ status: 'scheduled' }).toArray();
        for (const campaign of scheduledCampaigns) {
          if (!activeTasks.has(campaign.campaignId)) {
            console.log(`[Cron] Scheduled new campaign ${campaign.campaignId}`);
            registerTask(campaign, db, transporter);
          }
        }

        const activeIds = new Set(scheduledCampaigns.map(c => c.campaignId));
        for (const [id, task] of activeTasks.entries()) {
          if (!activeIds.has(id)) {
            task.stop();
            activeTasks.delete(id);
          }
        }
      } catch (e) {
        console.error('[Cron] Sync error:', e.message);
      }
    };

    // Perform an initial sync on startup
    await syncCampaigns();

    try {
      const changeStream = db.collection('jacaranda_campaigns').watch();
      console.log('[Cron] Successfully connected to MongoDB Change Stream (Real-time mode)');
      
      changeStream.on('change', async (change) => {
        if (change.operationType === 'insert' || change.operationType === 'update' || change.operationType === 'delete') {
          console.log(`[Cron] Real-time event detected (${change.operationType}). Syncing...`);
          await syncCampaigns();
        }
      });

      changeStream.on('error', (err) => {
        console.warn('[Cron] Change stream dropped. Falling back to polling mode.');
        setInterval(syncCampaigns, 15000);
      });
    } catch (e) {
      console.log('[Cron] Change streams not supported on this MongoDB instance. Using lightweight polling (15s).');
      setInterval(syncCampaigns, 15000);
    }

  } catch (err) {
    console.error('[Cron] Fatal error:', err.message);
    process.exit(1);
  }
}

processScheduledCampaigns();
console.log('[Cron] Service started.');
