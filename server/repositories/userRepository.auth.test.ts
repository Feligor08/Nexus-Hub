import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  getLastDatabaseStatus: vi.fn(() => ({ connected: true })),
  executeQuery: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('../config/database', () => database);

import { userRepository } from './userRepository';

const userRow = {
  id: 'user-id',
  username: 'dev_user',
  email: 'dev@example.net',
  display_name: 'Dev User',
  avatar_url: '',
  bio: '',
  status: 'ACTIVE',
  created_at: '2026-01-01 00:00:00',
  last_login_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  database.getLastDatabaseStatus.mockReturnValue({ connected: true });
  database.executeQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM user_sessions')) {
      return [{
        id: 'session-id',
        user_id: 'user-id',
        token_hash: createHash('sha256').update('valid-token').digest('hex'),
        expires_at: '2027-01-01 00:00:00',
        created_at: '2026-01-01 00:00:00',
      }];
    }
    if (sql.includes('FROM users')) return [userRow];
    if (sql.includes('FROM user_roles')) return [{ role_id: 'USER' }];
    if (sql.includes('FROM user_badges')) return [];
    return [];
  });
});

describe('MariaDB-backed sessions', () => {
  it('restores a valid unexpired session and never returns the raw token', async () => {
    const result = await userRepository.findSession('valid-token');
    expect(result?.user.id).toBe('user-id');
    expect(result?.session.tokenHash).toBe(createHash('sha256').update('valid-token').digest('hex'));
    expect(result?.session).not.toHaveProperty('token');
    expect(database.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('expires_at > NOW()'),
      [createHash('sha256').update('valid-token').digest('hex')]
    );
  });

  it('rejects expired and unknown sessions', async () => {
    database.executeQuery.mockResolvedValueOnce([]);
    expect(await userRepository.findSession('expired-token')).toBeNull();

    database.executeQuery.mockResolvedValueOnce([]);
    expect(await userRepository.findSession('unknown-token')).toBeNull();
  });

  it('revokes sessions by hash and never queries with the raw token', async () => {
    const token = 'logout-token';
    await userRepository.deleteSession(token);
    expect(database.executeQuery).toHaveBeenCalledWith(
      'DELETE FROM user_sessions WHERE token_hash = ?',
      [createHash('sha256').update(token).digest('hex')]
    );
  });

  it('preserves the current session and revokes other sessions after password change', async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      execute: vi.fn(async (sql: string, params: unknown[] = []) => {
        statements.push({ sql, params });
        return [{ affectedRows: 1 }, []];
      }),
    };
    database.withTransaction.mockImplementation(async (callback: (connection: typeof connection) => Promise<unknown>) => callback(connection));

    await userRepository.changePassword('user-id', 'new-hash', 'current-token');
    expect(statements[0].sql).toContain('UPDATE users SET password_hash');
    expect(statements[1].sql).toContain('token_hash <> ?');
    expect(statements[1].params).toEqual([
      'user-id',
      createHash('sha256').update('current-token').digest('hex'),
    ]);
  });
});