import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MONGO_URI must be set in your environment. Never hardcode credentials here.
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error('MONGO_URI environment variable is not set.');

const CRON_WORKER_URL = process.env.CRON_WORKER_URL || 'http://jacaranda-portal-cron:4000';

export async function GET() {
  try {
    const client = new MongoClient(MONGO_URI!);
    await client.connect();
    const db = client.db('LibreChat');

    const campaigns = await db.collection('jacaranda_campaigns')
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    const reportIds = campaigns.map((c) => c.reportId).filter(Boolean);
    const reports = await db.collection('jacaranda_reports')
      .find({ id: { $in: reportIds } })
      .project({ id: 1, query: 1, summary: 1 })
      .toArray();

    await client.close();

    const enrichedCampaigns = campaigns.map((camp) => {
      const r = reports.find((r) => r.id === camp.reportId);
      return {
        ...camp,
        reportDetails: r ? r : null,
      };
    });

    return NextResponse.json({ success: true, data: enrichedCampaigns });
  } catch (error: any) {
    console.error('Fetch Campaigns Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const client = new MongoClient(MONGO_URI!);
    await client.connect();
    const db = client.db('LibreChat');

    // Remove from MongoDB
    const result = await db.collection('jacaranda_campaigns').deleteOne({ campaignId: id });
    await client.close();

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Immediately kill the live background cron schedule instance
    try {
      const res = await fetch(`${CRON_WORKER_URL}/kill/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        console.warn(`[BFF] Cron worker returned ${res.status} when killing task ${id}. It may have already been inactive.`);
      }
    } catch (fetchErr: any) {
      console.warn(`[BFF] Could not contact cron worker to kill task ${id}:`, fetchErr.message);
    }

    return NextResponse.json({ success: true, message: `Campaign ${id} deleted and schedule killed.` });
  } catch (error: any) {
    console.error('Delete Campaign Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
