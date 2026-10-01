import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../models/types';

const repository = vi.hoisted(() => ({
  findByUsername: vi.fn(),
  findByEmail: vi.fn(),
  findWithCredentials: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  registerUser: vi.fn(),
  updateLastLogin: vi.fn(),
  createSession: vi.fn(),
  findSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock('../repositories/userRepository', () => ({ userRepository: repository }));

import { authService } from './authService';

const user: User = {
  id: 'user-id',
  username: 'dev_user',
  email: 'dev@example.net',
  displayName: 'Dev User',
  role: 'USER',
  roles: ['USER'],
  avatar: '',
  bio: '',
  skills: [],
  technologies: [],
  badges: [],
  createdAt: new Date(0).toISOString(),
  status: 'ACTIVE',
};

beforeEach(() => {
  vi.resetAllMocks();
  repository.findByUsername.mockResolvedValue(null);
  repository.findByEmail.mockResolvedValue(null);
  repository.hashPassword.mockResolvedValue('bcrypt-hash');
  repository.registerUser.mockImplementation(async (data: Partial<User>) => ({ ...user, ...data, role: 'USER', roles: ['USER'] }));
  repository.findWithCredentials.mockResolvedValue({ ...user, passwordHash: 'bcrypt-hash' });
  repository.verifyPassword.mockResolvedValue(true);
  repository.updateLastLogin.mockResolvedValue(undefined);
  repository.createSession.mockResolvedValue(undefined);
  repository.findSession.mockResolvedValue({ session: { id: 'session-id' }, user });
  repository.deleteSession.mockResolvedValue(undefined);
});

describe('AuthService registration', () => {
  it('creates a standard USER account with a hashed password and initial session', async () => {
    const result = await authService.register({
      username: 'dev_user',
      email: 'Dev@Example.net',
      password: 'correct-horse-battery',
      displayName: 'Dev User',
    }, '127.0.0.1', 'test-agent');

    expect(result.success).toBe(true);
    expect(result.user?.role).toBe('USER');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'dev@example.net', passwordHash: 'bcrypt-hash' }),
      result.token,
      '127.0.0.1',
      'test-agent'
    );
  });

  it('rejects duplicate usernames and emails with a conflict code', async () => {
    const registration = {
      username: 'dev_user',
      email: 'dev@example.net',
      password: 'correct-horse-battery',
      displayName: 'Dev User',
    };
    repository.findByUsername.mockResolvedValueOnce(user);
    expect((await authService.register(registration)).errorCode).toBe('CONFLICT');

    repository.findByUsername.mockResolvedValueOnce(null);
    repository.findByEmail.mockResolvedValueOnce(user);
    expect((await authService.register(registration)).errorCode).toBe('CONFLICT');
  });

  it('rejects malformed email and a password below policy', async () => {
    const base = { username: 'dev_user', email: 'invalid', password: 'short', displayName: 'Dev User' };
    expect((await authService.register(base)).success).toBe(false);
    expect(repository.hashPassword).not.toHaveBeenCalled();

    expect((await authService.register({ ...base, email: 'valid@example.net' })).success).toBe(false);
    expect(repository.hashPassword).not.toHaveBeenCalled();
  });
});

describe('AuthService login and session lifecycle', () => {
  it('accepts email or username credentials and creates a server-side session', async () => {
    const result = await authService.login({ email: 'dev_user', password: 'correct-horse-battery' }, '127.0.0.1');
    expect(result.success).toBe(true);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(repository.verifyPassword).toHaveBeenCalledWith('correct-horse-battery', 'bcrypt-hash');
    expect(repository.createSession).toHaveBeenCalledWith('user-id', result.token, '127.0.0.1', undefined);
  });

  it('uses the same generic failure for unknown, incorrect and suspended credentials', async () => {
    repository.findWithCredentials.mockResolvedValueOnce(null);
    const unknown = await authService.login({ email: 'unknown', password: 'wrong-password-long' });

    repository.verifyPassword.mockResolvedValueOnce(false);
    const incorrect = await authService.login({ email: 'dev_user', password: 'wrong-password-long' });

    repository.findWithCredentials.mockResolvedValueOnce({ ...user, status: 'SUSPENDED', passwordHash: 'bcrypt-hash' });
    const suspended = await authService.login({ email: 'dev_user', password: 'wrong-password-long' });

    expect(unknown.error).toBe(incorrect.error);
    expect(incorrect.error).toBe(suspended.error);
    expect(unknown.error).toBe('Ungültige Anmeldedaten.');
  });

  it('restores and revokes sessions through the repository', async () => {
    const restored = await authService.validateSession('opaque-session');
    expect(restored?.id).toBe('user-id');
    expect(repository.findSession).toHaveBeenCalledWith('opaque-session');
    await authService.logout('opaque-session');
    expect(repository.deleteSession).toHaveBeenCalledWith('opaque-session');
  });
});