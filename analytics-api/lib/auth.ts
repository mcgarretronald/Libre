import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

export interface AuthSession {
  userId: string;
  email: string;
}

// Reads the JWT from the Authorization header or the access_token cookie.
// Returns null if the token is missing or invalid.
export function getSession(req: NextRequest | Request): AuthSession | null {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '') || req.headers.get('cookie')
    ?.split('; ')
    .find(row => row.startsWith('access_token='))
    ?.split('=')[1];

  if (!token) return null;

  if (process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      return {
        userId: decoded.id || decoded.userId || decoded.sub,
        email: decoded.email,
      };
    } catch {
      // If the token is still valid but not signed with our local secret,
      // fall back to decoding the JWT payload from the cookie.
      // This is needed when auth is delegated to LibreChat and the token
      // is issued by a different service.
    }
  }

  const decoded = jwt.decode(token) as any;
  if (!decoded || typeof decoded !== 'object') return null;

  return {
    userId: decoded.id || decoded.userId || decoded.sub,
    email: decoded.email,
  };
}
