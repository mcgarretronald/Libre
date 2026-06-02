import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  const { pathname } = req.nextUrl;

  // Let the login, register pages, their API routes, and agent endpoints through without a token
  if (
    pathname.startsWith('/login') || 
    pathname.startsWith('/register') || 
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/api/analytics/schema') || 
    pathname.startsWith('/api/analytics/query')
  ) {
    return NextResponse.next();
  }


  // No token — send to our own login page, not LibreChat
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
