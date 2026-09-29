import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { User } from '../models/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionToken?: string;
}

/**
 * Helper to parse cookies without heavy third-party dependency
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.substring(0, idx).trim();
    const val = pair.substring(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

/**
 * Extracts session token from cookies or Authorization header
 */
export function extractToken(req: Request): string | null {
  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Check custom x-session-token header
  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  // 3. Check HttpOnly Cookie
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.nexus_session) {
    return cookies.nexus_session;
  }

  return null;
}

/**
 * Middleware that populates req.user if a valid session exists
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    if (token) {
      const user = await authService.validateSession(token);
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
    }
  } catch (err) {
    console.warn('Session authentication error:', err);
  }
  next();
};

/**
 * Middleware that requires the user to be authenticated
 */
export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      error: { message: 'Authentifizierung erforderlich. Bitte melde dich an.' },
    });
  }
  next();
};

/**
 * Middleware that requires one of the specified roles
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: { message: 'Authentifizierung erforderlich. Bitte melde dich an.' },
      });
    }

    // ADMIN role has universal governance
    if (req.user.role === 'ADMIN' || req.user.roles?.includes('ADMIN')) {
      return next();
    }

    const userRoles = req.user.roles || [req.user.role];
    const hasRole = roles.some((r) => userRoles.includes(r as any) || req.user?.role === r);

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Zugriff verweigert. Erforderliche Rolle: ${roles.join(' oder ')}.`,
        },
      });
    }

    next();
  };
};
