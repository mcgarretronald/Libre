import { NextResponse } from 'next/server';

const LIBRECHAT_URL = process.env.LIBRECHAT_URL || 'http://localhost:3080';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { name, email, password, confirm_password } = body;

  if (!name)             return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
  if (!email)            return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  if (!password)         return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  if (password !== confirm_password) return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 });

  // Forward registration to LibreChat
  let librechatRes: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    librechatRes = await fetch(`${LIBRECHAT_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, confirm_password }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return NextResponse.json(
        { error: 'The backend service took too long to respond. It may be waking up from sleep. Please try registering again.' },
        { status: 504 }
      );
    }
    console.error('[Register] Could not reach LibreChat:', err.message);
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
    const reason = data?.message || data?.error || 'Registration failed. The email may already be in use.';
    return NextResponse.json({ error: reason }, { status: librechatRes.status });
  }

  // If LibreChat returns a token on register, log the user straight in
  const token = data.token;
  if (token) {
    const response = NextResponse.json({ success: true, autoLogin: true });
    response.cookies.set('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  }

  // Otherwise just confirm success and let the user log in manually
  return NextResponse.json({ success: true, autoLogin: false });
}
