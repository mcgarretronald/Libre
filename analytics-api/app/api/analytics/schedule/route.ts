import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { reportId, recipients, schedule, customCron } = payload;
    
    if (!reportId || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Missing required campaign data' }, { status: 400 });
    }

    // Determine the exact cron string
    let cronExpression = '';
    if (schedule === 'immediate') {
      cronExpression = 'immediate';
    } else if (schedule === 'daily') {
      cronExpression = '0 8 * * *'; // 8 AM Daily
    } else if (schedule === 'weekly') {
      cronExpression = '0 9 * * 1'; // 9 AM Monday
    } else if (schedule === 'monthly') {
      cronExpression = '0 9 1 * *'; // 9 AM 1st of Month
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
      createdAt: new Date().toISOString()
    };

    // Store in MongoDB
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mcgarretronald_db_user:kYiKPjPnzfzQ4EXU@cluster0.gz3v4x7.mongodb.net/?appName=Cluster0';
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db('LibreChat');
    
    await db.collection('jacaranda_campaigns').insertOne(campaign);
    
    await client.close();

    // Notify cron worker
    try {
      if (schedule === 'immediate') {
        await fetch('http://portal-cron:4000/dispatch-immediate/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(campaign)
        });
      } else {
        await fetch('http://portal-cron:4000/start/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(campaign)
        });
      }
    } catch (webhookErr) {
      console.error('Failed to notify cron worker:', webhookErr);
    }

    return NextResponse.json({
      success: true,
      message: schedule === 'immediate' ? 'Campaign dispatched immediately' : 'Campaign successfully scheduled via Cron',
      campaign
    });

  } catch (error: any) {
    console.error('Campaign Scheduling Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
