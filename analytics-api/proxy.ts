import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  const { pathname } = req.nextUrl;

  // Bypass authentication for public and internal worker routes
  if (
    pathname.startsWith('/login') || 
    pathname.startsWith('/register') || 
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/api/analytics/schema') || 
    pathname.startsWith('/api/analytics/query') ||
    pathname.startsWith('/api/analytics/export')
  ) {
    return NextResponse.next();
  }


  // Redirect unauthenticated users to local login
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
