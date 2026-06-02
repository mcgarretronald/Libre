import { NextResponse } from 'next/server';

const LIBRECHAT_URL = process.env.LIBRECHAT_URL || 'http://localhost:3080';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  // Forward credentials to LibreChat's auth API
  let librechatRes: Response;
  try {
    librechatRes = await fetch(`${LIBRECHAT_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (err: any) {
    console.error('[Login] Could not reach LibreChat:', err.message);
    return NextResponse.json(
      { error: 'Could not reach the authentication service. Please try again shortly.' },
      { status: 503 }
    );
  }

  let data: any;
  try {
    data = await librechatRes.json();
  } catch {
    return NextResponse.json({ error: 'Unexpected response from auth service.' }, { status: 502 });
  }

  if (!librechatRes.ok) {
    const reason = data?.message || data?.error || 'Invalid email or password.';
    return NextResponse.json({ error: reason }, { status: 401 });
  }

  const token = data.token;
  if (!token) {
    return NextResponse.json({ error: 'No token received from auth service.' }, { status: 502 });
  }

  // Set the token as an HTTP-only cookie on our domain so the proxy can read it
  const response = NextResponse.json({ success: true });
  response.cookies.set('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return response;
}
