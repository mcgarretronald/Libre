import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { getSession } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// Returns all saved ClickHouse connections for the authenticated user.
// Returns an empty list (not an error) when called without a session.
export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const { db } = await connectToDatabase();
    const connections = await db.collection('jacaranda_connections')
      .find({ userId: session.userId })
      .toArray();

    const safeConnections = connections.map((conn: any) => ({
      id: conn._id.toString(),
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      databaseName: conn.databaseName,
      createdAt: conn.createdAt,
    }));

    return NextResponse.json({ success: true, data: safeConnections });
  } catch (err: any) {
    console.error('[Connections] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load connections. Please try refreshing.' },
      { status: 500 }
    );
  }
}

// Saves a new ClickHouse connection with the password encrypted at rest.
// Requires the user to be logged in so connections are scoped per account.
export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'You need to be logged in to save a connection.' },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const { name, host, port, username, password, databaseName } = body;

  if (!name)         return NextResponse.json({ success: false, error: 'Connection alias is required.' }, { status: 400 });
  if (!host)         return NextResponse.json({ success: false, error: 'Host URL is required.' }, { status: 400 });
  if (!username)     return NextResponse.json({ success: false, error: 'Username is required.' }, { status: 400 });
  if (!password)     return NextResponse.json({ success: false, error: 'Password is required.' }, { status: 400 });
  if (!databaseName) return NextResponse.json({ success: false, error: 'Database name is required.' }, { status: 400 });

  try {
    const encryptedPassword = encrypt(password);
    const { db } = await connectToDatabase();

    const result = await db.collection('jacaranda_connections').insertOne({
      userId: session.userId,
      name,
      host,
      port: Number(port) || 8443,
      username,
      password: encryptedPassword,
      databaseName,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: { id: result.insertedId.toString(), name, host },
    });
  } catch (err: any) {
    console.error('[Connections] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to save connection. Please try again.' },
      { status: 500 }
    );
  }
}

// Deletes a connection. Scoped to the authenticated user.
export async function DELETE(req: Request) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'You need to be logged in to delete a connection.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'Connection ID is required.' }, { status: 400 });
  }

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid connection ID.' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('jacaranda_connections').deleteOne({
      _id: objectId,
      userId: session.userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Connection not found or you do not have permission to delete it.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Connections] DELETE error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to delete connection. Please try again.' },
      { status: 500 }
    );
  }
}
