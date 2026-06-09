import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// Enforce environment-based credential loading
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/librechat';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { reportId, recipients, schedule, customCron, subject, body } = payload;

    if (!reportId || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Missing required campaign data' }, { status: 400 });
    }

    // Map predefined schedule labels to standard cron expressions
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
      subject,
      body,
      status: schedule === 'immediate' ? 'dispatched' : 'scheduled',
      createdAt: new Date().toISOString(),
    };

    // Persist campaign metadata in database
    const client = new MongoClient(MONGO_URI!);
    await client.connect();
    const db = client.db('LibreChat');
    await db.collection('jacaranda_campaigns').insertOne(campaign);
    await client.close();

    // The cron-worker running in Docker will automatically poll the database
    // and pick up both scheduled and immediate dispatches.

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
