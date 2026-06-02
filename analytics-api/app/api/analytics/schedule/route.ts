import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MONGO_URI must be set in your environment. Never hardcode credentials here.
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error('MONGO_URI environment variable is not set.');

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { reportId, recipients, schedule, customCron } = payload;

    if (!reportId || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Missing required campaign data' }, { status: 400 });
    }

    // Convert the schedule label to a cron expression
    let cronExpression = '';
    if (schedule === 'immediate') {
      cronExpression = 'immediate';
    } else if (schedule === 'daily') {
      cronExpression = '0 8 * * *'; // 8 AM every day
    } else if (schedule === 'weekly') {
      cronExpression = '0 9 * * 1'; // 9 AM every Monday
    } else if (schedule === 'monthly') {
      cronExpression = '0 9 1 * *'; // 9 AM on the 1st of each month
    } else if (schedule === 'custom') {
      cronExpression = customCron;
    }

    if (!cronExpression) {
      return NextResponse.json({ error: 'Invalid schedule' }, { status: 400 });
    }

    const campaign = {
      campaignId: `cmp_${Date.now()}`,
      reportId,
      recipients,
      scheduleType: schedule,
      cronExpression,
      status: schedule === 'immediate' ? 'dispatched' : 'scheduled',
      createdAt: new Date().toISOString(),
    };

    // Save the campaign to MongoDB
    const client = new MongoClient(MONGO_URI!);
    await client.connect();
    const db = client.db('LibreChat');
    await db.collection('jacaranda_campaigns').insertOne(campaign);
    await client.close();

    // Tell the cron worker about the new campaign
    try {
      const endpoint = schedule === 'immediate' ? 'dispatch-immediate' : 'start';
      await fetch(`http://portal-cron:4000/${endpoint}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaign),
      });
    } catch (webhookErr) {
      // Not fatal — the cron worker will pick it up on next poll
      console.error('[Schedule] Could not notify cron worker:', webhookErr);
    }

    return NextResponse.json({
      success: true,
      message: schedule === 'immediate' ? 'Campaign dispatched immediately' : 'Campaign scheduled',
      campaign,
    });

  } catch (error: any) {
    console.error('[Schedule] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
