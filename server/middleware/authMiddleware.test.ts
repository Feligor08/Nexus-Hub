import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatedRequest, requireRole } from './authMiddleware';
import { createIpRateLimiter } from './rateLimit';
import type { User } from '../models/types';

const roleUser = (role: User['role'], roles: string[] = [role]): User => ({
  id: `${role.toLowerCase()}-id`,
  username: `${role.toLowerCase()}_user`,
  email: `${role.toLowerCase()}@example.net`,
  displayName: role,
  role,
  roles,
  avatar: '',
  bio: '',
  skills: [],
  technologies: [],
  badges: [],
  createdAt: new Date(0).toISOString(),
  status: 'ACTIVE',
});

function responseMock() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

afterEach(() => vi.useRealTimers());

describe('server-side RBAC middleware', () => {
  it('allows a user only for the USER role', () => {
    const req = { user: roleUser('USER') } as AuthenticatedRequest;
    const res = responseMock();
    const next = vi.fn();
    requireRole('USER')(req, res as never, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('denies USER access to ADMIN and allows a Creator to access Creator CMS', () => {
    const userResponse = responseMock();
    requireRole('ADMIN')({ user: roleUser('USER') } as AuthenticatedRequest, userResponse as never, vi.fn());
    expect(userResponse.status).toHaveBeenCalledWith(403);

    const creatorNext = vi.fn();
    requireRole('CREATOR')({ user: roleUser('CREATOR') } as AuthenticatedRequest, responseMock() as never, creatorNext);
    expect(creatorNext).toHaveBeenCalledOnce();
  });

  it('allows moderators for moderation and admins for all roles', () => {
    const moderatorNext = vi.fn();
    requireRole('MODERATOR')({ user: roleUser('MODERATOR') } as AuthenticatedRequest, responseMock() as never, moderatorNext);
    expect(moderatorNext).toHaveBeenCalledOnce();

    const adminNext = vi.fn();
    requireRole('ADMIN')({ user: roleUser('ADMIN') } as AuthenticatedRequest, responseMock() as never, adminNext);
    expect(adminNext).toHaveBeenCalledOnce();
  });
});

describe('per-process IP rate limiter', () => {
  it('returns 429 after the configured attempt limit', () => {
    vi.useFakeTimers();
    const limiter = createIpRateLimiter(2, 60_000);
    const req = { baseUrl: '/api', path: '/auth/login', socket: { remoteAddress: '127.0.0.1' } } as unknown as Parameters<typeof limiter>[0];
    const res = responseMock();
    const next = vi.fn();

    limiter(req, res as never, next);
    limiter(req, res as never, next);
    limiter(req, res as never, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });
});