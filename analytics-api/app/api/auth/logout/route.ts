import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const response = NextResponse.redirect(`${origin}/login`);

  // Clear the access_token cookie so the proxy will redirect on the next request
  response.cookies.set('access_token', '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });

  return response;
}

