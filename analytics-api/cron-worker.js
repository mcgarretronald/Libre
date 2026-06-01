const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const http = require('http');

const activeTasks = new Map(); // Track live cron task instances

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/librechat';

// ── SMTP transporter ──────────────────────────────────────────────────────
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

// ── Dispatch a single campaign ────────────────────────────────────────────
async function dispatchCampaign(db, campaign, transporter) {
  console.log(`\n[DEBUG - CRON WORKER] ========================================`);
  console.log(`[DEBUG] TRIGGERED: Campaign ${campaign.campaignId}`);
  console.log(`[DEBUG] Target Recipients count: ${campaign.recipients.length}`);
  console.log(`[DEBUG] Scheduled mode: ${campaign.scheduleType || 'immediate'}`);

  // Fetch the report
  const report = await db.collection('jacaranda_reports').findOne({ id: campaign.reportId });
  const reportTitle = (report?.query?.length > 60 ? report.query.substring(0, 60) + '...' : report?.query) || 'Analytics Report';
  console.log(`[DEBUG] Report Title retrieved: "${reportTitle}"`);

  // Generate professional HTML email body directly (no attachments)
  const attachments = [];

  let successCount = 0;
  let failCount = 0;

  for (const recipient of campaign.recipients) {
    console.log(`[DEBUG] Attempting to send email to -> ${recipient.email}`);
    
    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #FDFCFB; margin: 0; padding: 40px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
        <div style="background-color: #3B143C; padding: 24px; text-align: center;">
          <img src="https://jacarandahealth.org/ypoagriw/2023/09/JH-LOGO-WHITE-1.svg" alt="Jacaranda Health" style="height: 32px;" />
        </div>
        
        <div style="padding: 40px 32px;">
          <h2 style="color: #3B143C; font-size: 20px; font-weight: bold; margin-top: 0; margin-bottom: 8px;">Analytical Intelligence Brief</h2>
          <p style="color: #64748b; font-size: 14px; margin-bottom: 24px; line-height: 1.6;">Hello ${recipient.name || 'Team'},</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #E06A55; padding: 20px; margin-bottom: 32px; border-radius: 0 8px 8px 0;">
            <h3 style="color: #1E6B65; font-size: 16px; font-weight: bold; margin-top: 0; margin-bottom: 12px;">${reportTitle}</h3>
            <p style="color: #334155; font-size: 14px; line-height: 1.7; margin: 0;">${(report?.summary || 'No summary available.').replace(/\\n/g, '<br>')}</p>
          </div>
          
          <div style="text-align: center; margin-top: 40px;">
            <a href="http://localhost:3000" style="display: inline-block; background-color: #E06A55; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: bold; padding: 14px 36px; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px;">Access Live Dashboard</a>
          </div>
        </div>
        
        <div style="background-color: #f1f5f9; padding: 24px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">Automated intelligence dispatch from Jacaranda Health Operations Portal.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      const info = await transporter.sendMail({
        from: '"Jacaranda Analytics" <' + process.env.SMTP_USER + '>',
        to: recipient.email,
        subject: reportTitle + ' — Jacaranda Health Report',
        html: htmlBody,
      });
      console.log(`[DEBUG] ✓ Dispatched successfully to ${recipient.email}. Message ID: ${info.messageId}`);
      successCount++;
    } catch (err) {
      console.error(`[DEBUG-ERROR] ✗ SMTP Failed for ${recipient.email}:`, err.message);
      failCount++;
    }
  }

  // Update campaign status in MongoDB
  console.log(`[DEBUG] Updating campaign record in DB with completion stats...`);
  await db.collection('jacaranda_campaigns').updateOne(
    { campaignId: campaign.campaignId },
    {
      $set: {
        lastRunAt: new Date().toISOString(),
        lastRunStats: { successCount, failCount },
      },
    }
  );

  console.log(`[Cron Worker] Campaign ${campaign.campaignId} complete: ${successCount} sent, ${failCount} failed`);
}

// ── Dynamic Schedule Registration ───────────────────────────────────────────
function registerTask(campaign, db, transporter) {
  if (!cron.validate(campaign.cronExpression)) {
    console.error(`[Cron Worker] Invalid cron expression for campaign ${campaign.campaignId}: "${campaign.cronExpression}"`);
    return;
  }

  console.log(`[Cron Worker] Scheduling campaign ${campaign.campaignId} → cron: "${campaign.cronExpression}"`);

  const task = cron.schedule(campaign.cronExpression, async () => {
    try {
      await dispatchCampaign(db, campaign, transporter);
    } catch (err) {
      console.error(`[Cron Worker] Dispatch error for ${campaign.campaignId}:`, err.message);
    }
  });
  
  activeTasks.set(campaign.campaignId, task);
}

// ── Main polling loop & HTTP Server ───────────────────────────────────────
async function processScheduledCampaigns() {
  console.log('[Cron Worker] Polling MongoDB for active campaigns...');
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db('LibreChat');
    const campaigns = await db.collection('jacaranda_campaigns').find({ status: 'scheduled' }).toArray();

    if (campaigns.length === 0) {
      console.log('[Cron Worker] No active scheduled campaigns found. Booting control server anyway...');
    } else {
      console.log(`[Cron Worker] Found ${campaigns.length} campaign(s) — registering cron jobs...`);
    }

    const transporter = createTransporter();

    // Verify SMTP connection
    try {
      await transporter.verify();
      console.log('[Cron Worker] SMTP connection verified ✓');
    } catch (smtpErr) {
      console.error('[Cron Worker] SMTP connection failed — check SMTP_USER and SMTP_PASSWORD:', smtpErr.message);
    }

    if (campaigns.length > 0) {
      campaigns.forEach((campaign) => {
        registerTask(campaign, db, transporter);
      });
    }

    // ── Internal HTTP API for Webhooks ──
    const server = http.createServer((req, res) => {
      // Allow dynamic un-registering of jobs
      if (req.method === 'DELETE' && req.url.startsWith('/kill/')) {
        const campaignId = req.url.replace('/kill/', '');
        const task = activeTasks.get(campaignId);
        if (task) {
          task.stop();
          activeTasks.delete(campaignId);
          console.log(`[Cron Worker] API KILLED schedule for campaign: ${campaignId}`);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: `Stopped task ${campaignId}` }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Task not found in memory' }));
        }
      } 
      // Allow dynamic starting of jobs
      else if (req.method === 'POST' && req.url.startsWith('/start/')) {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const campaign = JSON.parse(body);
            registerTask(campaign, db, transporter);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
          } catch(e) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Bad payload' }));
          }
        });
      }
      // Allow immediate dispatching
      else if (req.method === 'POST' && req.url.startsWith('/dispatch-immediate/')) {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
          try {
            const campaign = JSON.parse(body);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
            
            // Dispatch asynchronously after sending 200 OK
            await dispatchCampaign(db, campaign, transporter);
          } catch(e) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Bad payload' }));
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(4000, '0.0.0.0', () => {
      console.log('[Cron Worker] HTTP Control Server listening on port 4000');
    });

    // Also handle any "immediate" campaigns that weren't sent yet
    const immediateCampaigns = await db
      .collection('jacaranda_campaigns')
      .find({ status: 'dispatched', lastRunAt: { $exists: false } })
      .toArray();

    if (immediateCampaigns.length > 0) {
      console.log(`[Cron Worker] Found ${immediateCampaigns.length} immediate campaign(s) to process...`);
      for (const campaign of immediateCampaigns) {
        await dispatchCampaign(db, campaign, transporter);
      }
    }

  } catch (err) {
    console.error('[Cron Worker] Fatal error:', err.message);
    await client.close();
    process.exit(1);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────
processScheduledCampaigns();
console.log('[Cron Worker] Service started — listening for scheduled campaigns...');
