import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { projectRepository } from '../repositories/projectRepository';
import { productRepository } from '../repositories/productRepository';
import { orderRepository } from '../repositories/orderRepository';
import { downloadRepository } from '../repositories/downloadRepository';
import { communityRepository } from '../repositories/communityRepository';
import { authService } from './authService';
import { redactSecret, validateEnvironmentConfig } from '../config/env';
import type { Project, Product, Order, User } from '../models/types';

// Mock DB
const db = vi.hoisted(() => ({
  getLastDatabaseStatus: vi.fn(() => ({ connected: true })),
  testDatabaseConnection: vi.fn(() => ({ connected: true })),
  executeQuery: vi.fn(),
  withTransaction: vi.fn((cb: any) => cb({
    execute: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
  })),
}));

vi.mock('../config/database', () => db);

describe('Security, IDOR & Authorization Audit (Sprint 9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getLastDatabaseStatus.mockReturnValue({ connected: true });
  });

  describe('1. Middleware Authorization & Role Boundaries', () => {
    it('requireAuth rejects unauthenticated requests with 401', () => {
      const req: Partial<AuthenticatedRequest> = {};
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      requireAuth(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('requireRole rejects normal USER on ADMIN endpoint with 403', () => {
      const req: Partial<AuthenticatedRequest> = {
        user: {
          id: 'user-1',
          username: 'normal_user',
          email: 'user@example.com',
          displayName: 'Normal User',
          role: 'USER',
          roles: ['USER'],
          avatar: '',
          bio: '',
          skills: [],
          technologies: [],
          badges: [],
          createdAt: '',
          status: 'ACTIVE',
        },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      const adminGuard = requireRole('ADMIN');
      adminGuard(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('requireRole allows ADMIN access on protected endpoints', () => {
      const req: Partial<AuthenticatedRequest> = {
        user: {
          id: 'admin-1',
          username: 'FelixFocus08',
          email: 'fschlueter08@gmail.com',
          displayName: 'FelixFocus08',
          role: 'ADMIN',
          roles: ['ADMIN'],
          avatar: '',
          bio: '',
          skills: [],
          technologies: [],
          badges: [],
          createdAt: '',
          status: 'ACTIVE',
        },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      const adminGuard = requireRole('ADMIN');
      adminGuard(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('2. IDOR Protection (Horizontal Privilege Escalation)', () => {
    it('prevents non-owner from updating a project when authorId does not match', async () => {
      // Mock database returning project owned by user-author-1
      db.executeQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM projects WHERE id = ?')) {
          return [{
            id: 'proj-1',
            author_id: 'user-author-1',
            title: 'Author Project',
            slug: 'author-project',
            category: 'Software',
            status: 'PUBLISHED',
          }];
        }
        return [];
      });

      // User attacker-2 tries to update with their authorCheck
      const result = await projectRepository.update('proj-1', { title: 'Hacked Title' }, 'attacker-2');

      expect(result).toBeNull();
    });

    it('prevents non-owner from updating a product when authorId does not match', async () => {
      db.executeQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM products WHERE id = ?')) {
          return [{
            id: 'prod-1',
            author_id: 'user-author-1',
            name: 'Creator Template',
            slug: 'creator-template',
            price: 19.99,
            currency: 'EUR',
            status: 'PUBLISHED',
          }];
        }
        return [];
      });

      const result = await productRepository.update('prod-1', { name: 'Hacked Product' }, 'attacker-2');

      expect(result).toBeNull();
    });

    it('prevents non-author from deleting another user community post', async () => {
      db.executeQuery.mockResolvedValueOnce([{ user_id: 'victim-user-1' }]);

      await expect(
        communityRepository.deletePost('post-123', 'attacker-user-2', false)
      ).rejects.toThrow('Keine Berechtigung zum Löschen dieses Beitrags.');
    });

    it('prevents non-author from deleting another user community comment', async () => {
      db.executeQuery.mockResolvedValueOnce([{ author_id: 'victim-user-1' }]);

      await expect(
        communityRepository.deleteComment('post-123', 'comm-456', 'attacker-user-2', false)
      ).rejects.toThrow('Keine Berechtigung zum Löschen dieses Kommentars.');
    });
  });

  describe('3. Store, Checkout & Payment Integrity', () => {
    it('verifies that orderRepository retrieves only orders belonging to the specified user', async () => {
      db.executeQuery.mockResolvedValueOnce([
        {
          id: 'ord-101',
          user_id: 'user-alice',
          total_amount: 0,
          currency: 'EUR',
          status: 'COMPLETED',
          payment_status: 'NOT_REQUIRED',
          download_token: 'dl-alice-token',
          created_at: new Date().toISOString(),
        },
      ]);
      db.executeQuery.mockResolvedValueOnce([]); // order_items query

      const aliceOrders = await orderRepository.findByUserId('user-alice');
      expect(aliceOrders).toHaveLength(1);
      expect(aliceOrders[0].userId).toBe('user-alice');

      // The executed SQL must strictly include WHERE user_id = ?
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ?'),
        ['user-alice']
      );
    });

    it('verifies that download entitlements are strictly scoped to the requesting user', async () => {
      db.executeQuery.mockResolvedValueOnce([
        {
          id: 'ent-1',
          user_id: 'user-bob',
          product_id: 'prod-1',
          order_id: 'ord-1',
          product_name: 'Bob Product',
          file_format: 'ZIP',
          file_size: '10 MB',
          version: '1.0.0',
          created_at: new Date().toISOString(),
        },
      ]);

      const bobEnts = await downloadRepository.getUserEntitlements('user-bob');
      expect(bobEnts).toHaveLength(1);
      expect(bobEnts[0].productName).toBe('Bob Product');
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE de.user_id = ?'),
        ['user-bob']
      );
    });

    it('rejects download token consumption when token is invalid', async () => {
      db.executeQuery.mockResolvedValueOnce([]); // No matching token found

      const result = await downloadRepository.verifyAndConsumeToken('invalid-or-fake-token');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Ungültiger');
      expect(result.product).toBeUndefined();
    });

    it('rejects download token consumption when token is expired', async () => {
      db.executeQuery.mockResolvedValueOnce([
        {
          id: 'tok-1',
          token: 'expired-token',
          expires_at: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour in the past
          download_count: 0,
          max_downloads: 5,
          user_id: 'user-1',
          product_id: 'prod-1',
          order_id: 'ord-1',
          name: 'Expired Product',
          file_format: 'ZIP',
          file_size: '10 MB',
          version: '1.0.0',
        },
      ]);

      const result = await downloadRepository.verifyAndConsumeToken('expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('abgelaufen');
    });
  });

  describe('4. Environment & Secrets Sanitization', () => {
    it('redacts sensitive values safely in logs', () => {
      expect(redactSecret('mySecretDatabasePassword123')).toBe('my****23');
      expect(redactSecret('1234')).toBe('****');
      expect(redactSecret('')).toBe('[EMPTY]');
      expect(redactSecret(null)).toBe('[EMPTY]');
    });

    it('detects missing or insecure secrets in strict production mode', () => {
      const result = validateEnvironmentConfig(true, {});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('SESSION_SECRET'))).toBe(true);
      expect(result.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
      expect(result.errors.some((e) => e.includes('DB_HOST'))).toBe(true);
    });

    it('rejects default insecure JWT_SECRET placeholder in production', () => {
      const result = validateEnvironmentConfig(true, {
        SESSION_SECRET: 'super-secure-production-session-secret-random-32-chars',
        JWT_SECRET: 'your-jwt-secure-random-secret',
        DB_HOST: '100.70.45.109',
        DB_PASSWORD: 'real-password',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
    });

    it('passes development configuration gracefully with guidance warnings', () => {
      const devResult = validateEnvironmentConfig(false);
      expect(devResult.valid).toBe(true);
      expect(devResult.errors).toHaveLength(0);
    });
  });
});
