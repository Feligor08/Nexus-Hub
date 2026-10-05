import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory rate limiting stores (IP-based and Account-based)
const ipLoginAttempts = new Map<string, RateLimitRecord>();
const accountLoginAttempts = new Map<string, RateLimitRecord>();
const ipRegisterAttempts = new Map<string, RateLimitRecord>();

// Clean up expired records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipLoginAttempts.entries()) {
    if (record.resetAt <= now) ipLoginAttempts.delete(key);
  }
  for (const [key, record] of accountLoginAttempts.entries()) {
    if (record.resetAt <= now) accountLoginAttempts.delete(key);
  }
  for (const [key, record] of ipRegisterAttempts.entries()) {
    if (record.resetAt <= now) ipRegisterAttempts.delete(key);
  }
}, 5 * 60 * 1000);

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Rate Limiter for Login:
 * - Max 10 requests per IP per minute
 * - Max 5 failed attempts per (IP + account identifier) per 15 minutes
 */
export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const identifier = ((req.body?.emailOrUsername || req.body?.email || '') as string).trim().toLowerCase();
  const now = Date.now();

  // 1. Check IP general frequency (10 requests/minute)
  const ipRecord = ipLoginAttempts.get(ip);
  if (ipRecord && ipRecord.resetAt > now) {
    if (ipRecord.count >= 10) {
      return res.status(429).json({
        success: false,
        error: { message: 'Zu viele Anmeldeversuche von dieser IP-Adresse. Bitte warte einen Moment.' },
      });
    }
    ipRecord.count++;
  } else {
    ipLoginAttempts.set(ip, { count: 1, resetAt: now + 60 * 1000 });
  }

  // 2. Check Account-specific attempts (5 failed attempts / 15 minutes)
  if (identifier) {
    const accountKey = `${ip}:${identifier}`;
    const accountRecord = accountLoginAttempts.get(accountKey);
    if (accountRecord && accountRecord.resetAt > now) {
      if (accountRecord.count >= 5) {
        return res.status(429).json({
          success: false,
          error: { message: 'Zu viele fehlgeschlagene Anmeldeversuche für dieses Konto. Bitte warte 15 Minuten.' },
        });
      }
    }
  }

  next();
}

/**
 * Records a failed login attempt for account-specific rate limiting
 */
export function recordFailedLogin(req: Request) {
  const ip = getClientIp(req);
  const identifier = ((req.body?.emailOrUsername || req.body?.email || '') as string).trim().toLowerCase();
  if (!identifier) return;

  const accountKey = `${ip}:${identifier}`;
  const now = Date.now();
  const record = accountLoginAttempts.get(accountKey);

  if (record && record.resetAt > now) {
    record.count++;
  } else {
    accountLoginAttempts.set(accountKey, { count: 1, resetAt: now + 15 * 60 * 1000 });
  }
}

/**
 * Clears failed login counter upon successful authentication
 */
export function recordSuccessfulLogin(req: Request) {
  const ip = getClientIp(req);
  const identifier = ((req.body?.emailOrUsername || req.body?.email || '') as string).trim().toLowerCase();
  if (identifier) {
    accountLoginAttempts.delete(`${ip}:${identifier}`);
  }
}

/**
 * Rate Limiter for Registration:
 * - Max 5 registrations per IP per hour
 */
export function registerRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();

  const record = ipRegisterAttempts.get(ip);
  if (record && record.resetAt > now) {
    if (record.count >= 5) {
      return res.status(429).json({
        success: false,
        error: { message: 'Zu viele Registrierungsanfragen von dieser IP-Adresse. Bitte versuche es später erneut.' },
      });
    }
    record.count++;
  } else {
    ipRegisterAttempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
  }

  next();
}
