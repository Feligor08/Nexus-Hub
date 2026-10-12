import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../models/types';

const repository = vi.hoisted(() => ({
  findByUsername: vi.fn(),
  findByEmail: vi.fn(),
  createUser: vi.fn(),
  updateRole: vi.fn(),
  hashPassword: vi.fn(),
}));

const db = vi.hoisted(() => ({
  getLastDatabaseStatus: vi.fn((): any => ({ connected: true, status: 'connected', diagnosticCode: 'DB_CONNECTED' })),
  testDatabaseConnection: vi.fn(),
  executeQuery: vi.fn(),
}));

const audit = vi.hoisted(() => ({
  log: vi.fn(),
}));

vi.mock('../repositories/userRepository', () => ({ userRepository: repository }));
vi.mock('../config/database', () => db);
vi.mock('../repositories/auditRepository', () => ({ auditRepository: audit }));

import {
  bootstrapAdmin,
  isValidAdminPassword,
  isValidUsername,
  normalizeEmail,
} from './adminBootstrap';

describe('Admin Bootstrap — Sprint 9 Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.testDatabaseConnection.mockResolvedValue({
      connected: true,
      diagnosticCode: 'DB_CONNECTED',
      latencyMs: 12,
    });
    db.getLastDatabaseStatus.mockReturnValue({
      connected: true,
      status: 'connected',
    });
    repository.findByUsername.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue(null);
    repository.hashPassword.mockResolvedValue('$2a$12$secureHashedAdminPasswordHash');
    repository.createUser.mockImplementation(async (data: any) => ({
      ...data,
      id: data.id || 'usr-admin-1',
      role: 'ADMIN',
      roles: ['ADMIN'],
    }));
    repository.updateRole.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);
  });

  describe('Validation & Helpers', () => {
    it('normalizes email addresses correctly', () => {
      expect(normalizeEmail('  Felix@EXAMPLE.com ')).toBe('felix@example.com');
    });

    it('enforces username format', () => {
      expect(isValidUsername('FelixFocus08')).toBe(true);
      expect(isValidUsername('ab')).toBe(false);
      expect(isValidUsername('invalid user with spaces')).toBe(false);
      expect(isValidUsername('user<script>')).toBe(false);
    });

    it('enforces minimum 12-character password strength', () => {
      expect(isValidAdminPassword('short123')).toBe(false);
      expect(isValidAdminPassword('12345678901')).toBe(false);
      expect(isValidAdminPassword('123456789012')).toBe(true);
      expect(isValidAdminPassword('SuperSecurePassword2026!')).toBe(true);
    });
  });

  describe('Edge Cases & Failure Modes', () => {
    it('fails when password is missing', async () => {
      const result = await bootstrapAdmin({
        username: 'FelixFocus08',
        email: 'fschlueter08@gmail.com',
        password: '',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('ERROR');
      expect(result.message).toContain('Passwort fehlt');
    });

    it('fails when password is shorter than 12 characters', async () => {
      const result = await bootstrapAdmin({
        username: 'FelixFocus08',
        email: 'fschlueter08@gmail.com',
        password: 'kurzesPass1',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('ERROR');
      expect(result.message).toContain('mindestens 12 Zeichen');
    });

    it('fails when MariaDB is disconnected and does not create an in-memory phantom', async () => {
      db.testDatabaseConnection.mockResolvedValueOnce({
        connected: false,
        diagnosticCode: 'DB_PORT_UNREACHABLE',
      });

      const result = await bootstrapAdmin({
        username: 'FelixFocus08',
        email: 'fschlueter08@gmail.com',
        password: 'SuperSecurePassword2026!',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('ERROR');
      expect(result.message).toContain('MariaDB ist nicht erreichbar');
      expect(repository.createUser).not.toHaveBeenCalled();
    });

    it('aborts safely if an account exists with the same email but a different username', async () => {
      const otherUser: User = {
        id: 'usr-different',
        username: 'other_dev',
        email: 'fschlueter08@gmail.com',
        displayName: 'Other Dev',
        role: 'USER',
        roles: ['USER'],
        avatar: '',
        bio: '',
        skills: [],
        technologies: [],
        badges: [],
        createdAt: new Date().toISOString(),
        status: 'ACTIVE',
      };
      repository.findByEmail.mockResolvedValueOnce(otherUser);
      repository.findByUsername.mockResolvedValueOnce(null);

      const result = await bootstrapAdmin({
        username: 'FelixFocus08',
        email: 'fschlueter08@gmail.com',
        password: 'SuperSecurePassword2026!',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('CONFLICT');
      expect(result.message).toContain('abweichendem Benutzernamen');
      expect(repository.createUser).not.toHaveBeenCalled();
    });

    it('aborts safely if an account exists with the same username but a different email', async () => {
      const otherUser: User = {
        id: 'usr-different',
        username: 'FelixFocus08',
        email: 'hacker@malicious.com',
        displayName: 'Felix Focus',
        role: 'USER',
        roles: ['USER'],
        avatar: '',
        bio: '',
        skills: [],
        technologies: [],
        badges: [],
        createdAt: new Date().toISOString(),
        status: 'ACTIVE',
      };
      repository.findByEmail.mockResolvedValueOnce(null);
      repository.findByUsername.mockResolvedValueOnce(otherUser);

      const result = await bootstrapAdmin({
        username: 'FelixFocus08',
        email: 'fschlueter08@gmail.com',
        password: 'SuperSecurePassword2026!',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('CONFLICT');
      expect(result.message).toContain('abweichender E-Mail');
      expect(repository.createUser).not.toHaveBeenCalled();
    });
  });

  describe('Successful Execution & Idempotency', () => {
    it('creates the initial administrator account cleanly', async () => {
      const result = await bootstrapAdmin({
        username: 'FelixFocus08',
        email: 'fschlueter08@gmail.com',
        displayName: 'FelixFocus08',
        password: 'SuperSecurePassword2026!',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('CREATED');
      expect(result.username).toBe('FelixFocus08');
      expect(result.email).toBe('fschlueter08@gmail.com');
      expect(result.role).toBe('ADMIN');

      expect(repository.hashPassword).toHaveBeenCalledWith('SuperSecurePassword2026!');
      expect(repository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'FelixFocus08',
          email: 'fschlueter08@gmail.com',
          initialRole: 'ADMIN',
        })
      );
      expect(repository.updateRole).toHaveBeenCalled();

      // Verify audit log was recorded without passwords
      expect(audit.log).toHaveBeenCalledWith(
        'ADMIN_BOOTSTRAP',
        expect.any(String),
        'FelixFocus08',
        expect.stringContaining('Neues Administrator-Konto via CLI-Bootstrap initialisiert'),
        '127.0.0.1'
      );
      const auditDetails = audit.log.mock.calls[0][3];
      expect(auditDetails).not.toContain('SuperSecurePassword2026!');
    });

    it('idempotently updates an existing matching administrator without conflict', async () => {
      const existingAdmin: User = {
        id: 'usr-admin-felix',
        username: 'FelixFocus08',
        email: 'fschlueter08@gmail.com',
        displayName: 'FelixFocus08',
        role: 'USER',
        roles: ['USER'],
        avatar: '',
        bio: '',
        skills: [],
        technologies: [],
        badges: [],
        createdAt: new Date().toISOString(),
        status: 'ACTIVE',
      };
      repository.findByEmail.mockResolvedValue(existingAdmin);
      repository.findByUsername.mockResolvedValue(existingAdmin);

      const result = await bootstrapAdmin({
        username: 'FelixFocus08',
        email: 'fschlueter08@gmail.com',
        displayName: 'FelixFocus08',
        password: 'NewSuperPassword2026!',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('UPDATED');
      expect(result.userId).toBe('usr-admin-felix');
      expect(repository.createUser).not.toHaveBeenCalled();
      expect(repository.updateRole).toHaveBeenCalledWith('usr-admin-felix', 'ADMIN');
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET password_hash = ?'),
        expect.arrayContaining(['$2a$12$secureHashedAdminPasswordHash', 'usr-admin-felix'])
      );
      expect(audit.log).toHaveBeenCalledWith(
        'ADMIN_BOOTSTRAP',
        'usr-admin-felix',
        'FelixFocus08',
        expect.stringContaining('aktualisiert'),
        '127.0.0.1'
      );
    });
  });
});
