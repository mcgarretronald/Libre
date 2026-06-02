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
clientPromise = global._mongoClientPromise!;

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const client = await clientPromise;
    const db = client.db('LibreChat');

    const numericId = parseInt(id, 10);
    const result = await db.collection('jacaranda_reports').deleteOne(
      !isNaN(numericId) ? { id: numericId } : { id }
    );

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Reports] Delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
