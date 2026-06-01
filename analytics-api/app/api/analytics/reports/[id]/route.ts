import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mcgarretronald_db_user:kYiKPjPnzfzQ4EXU@cluster0.gz3v4x7.mongodb.net/LibreChat?appName=Cluster0';

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

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

    return NextResponse.json({ success: true, message: 'Report deleted successfully' });
  } catch (error: any) {
    console.error('Delete Report Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
