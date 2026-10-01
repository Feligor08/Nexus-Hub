import { RequestHandler } from 'express';

export function createIpRateLimiter(limit: number, windowMs: number): RequestHandler {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const now = Date.now();
    if (attempts.size > 5000) {
      for (const [key, bucket] of attempts) {
        if (bucket.resetAt <= now) attempts.delete(key);
      }
      while (attempts.size > 5000) {
        const oldest = attempts.keys().next().value;
        if (oldest === undefined) break;
        attempts.delete(oldest);
      }
    }

    const key = `${req.baseUrl}${req.path}:${req.socket.remoteAddress || 'unknown'}`;
    const current = attempts.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    if (bucket.count >= limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      res.status(429).json({ success: false, error: { message: 'Zu viele Versuche. Bitte später erneut versuchen.' } });
      return;
    }
    bucket.count += 1;
    attempts.set(key, bucket);
    next();
  };
}