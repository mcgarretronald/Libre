import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MONGO_URI must be set in your environment. Never hardcode credentials here.
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error('MONGO_URI environment variable is not set.');

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Reuse the MongoDB connection across hot reloads in development
let clientPromise: Promise<MongoClient>;
if (!global._mongoClientPromise) {
  const client = new MongoClient(MONGO_URI);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('LibreChat');

    const reports = await db
      .collection('jacaranda_reports')
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .project({ _id: 0 })
      .toArray();

    // Strip large HTML/PDF blobs and replace with URL references for the UI
    const clientReports = reports.map(({ pdfBase64, htmlMarkup, ...r }: any) => ({
      ...r,
      pdfUrl: `/api/analytics/pdf/${r.id}`,
      htmlUrl: `/api/analytics/html/${r.id}`,
      hasPdf: !!pdfBase64,
      hasHtml: !!htmlMarkup,
    }));

    return NextResponse.json({ success: true, data: clientReports });
  } catch (error: any) {
    console.error('[Reports] Fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
