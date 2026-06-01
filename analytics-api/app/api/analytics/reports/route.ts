import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// Initialize MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mcgarretronald_db_user:kYiKPjPnzfzQ4EXU@cluster0.gz3v4x7.mongodb.net/LibreChat?appName=Cluster0';

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!global._mongoClientPromise) {
  client = new MongoClient(MONGO_URI);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export async function GET() {
  try {
    const client = await clientPromise;
    // Connect to the DB (it usually extracts the DB name from the URI, or default to 'LibreChat')
    const db = client.db('LibreChat'); 
    
    // Fetch recent Jacaranda reports, sorted by most recent
    const reports = await db
      .collection('jacaranda_reports')
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .project({ _id: 0 })
      .toArray();

    // Strip bulky pdfBase64 blobs and inject pdfUrl and htmlUrl for the UI
    const clientReports = reports.map(({ pdfBase64, htmlMarkup, ...r }: any) => ({
      ...r,
      pdfUrl: `/api/analytics/pdf/${r.id}`,
      htmlUrl: `/api/analytics/html/${r.id}`,
      hasPdf: !!pdfBase64,
      hasHtml: !!htmlMarkup,
    }));

    return NextResponse.json({ success: true, data: clientReports });
  } catch (error: any) {
    console.error('MongoDB Fetch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
