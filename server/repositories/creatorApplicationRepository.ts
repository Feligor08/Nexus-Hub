import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { CreatorApplication } from '../models/types';
import { db } from '../db';
import { userRepository } from './userRepository';

export class CreatorApplicationRepository {
  async findByUserId(userId: string): Promise<CreatorApplication | null> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT * FROM creator_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            userId: r.user_id,
            portfolioUrl: r.portfolio_url,
            motivation: r.motivation,
            plannedProjects: r.planned_projects,
            plannedContent: r.planned_content,
            status: r.status,
            adminNotes: r.admin_notes,
            reviewedBy: r.reviewed_by,
            reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : undefined,
            createdAt: new Date(r.created_at).toISOString(),
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
          };
        }
      } catch (err) {
        console.warn('MariaDB creator_applications findByUserId error:', err);
      }
    }

    const app = db.creatorApplications
      .slice()
      .reverse()
      .find((a) => a.userId === userId);
    return app || null;
  }

  async create(data: {
    userId: string;
    portfolioUrl?: string;
    motivation: string;
    plannedProjects: string;
    plannedContent: string;
  }): Promise<CreatorApplication> {
    const id = `ca-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    const newApp: CreatorApplication = {
      id,
      userId: data.userId,
      portfolioUrl: data.portfolioUrl,
      motivation: data.motivation,
      plannedProjects: data.plannedProjects,
      plannedContent: data.plannedContent,
      status: 'PENDING',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO creator_applications (id, user_id, portfolio_url, motivation, planned_projects, planned_content, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
          [
            id,
            data.userId,
            data.portfolioUrl || null,
            data.motivation,
            data.plannedProjects,
            data.plannedContent,
          ]
        );
      } catch (err) {
        console.warn('MariaDB creator_applications create error:', err);
      }
    }

    db.creatorApplications.push(newApp);
    return newApp;
  }

  async findAll(options?: { status?: string; page?: number; limit?: number }): Promise<{
    applications: CreatorApplication[];
    total: number;
  }> {
    const dbStatus = getLastDatabaseStatus();
    const limit = Math.min(options?.limit || 20, 100);
    const page = Math.max(1, options?.page || 1);
    const offset = (page - 1) * limit;

    if (dbStatus.connected) {
      try {
        let sql = `
          SELECT ca.*, u.username, u.email, u.display_name 
          FROM creator_applications ca
          LEFT JOIN users u ON ca.user_id = u.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (options?.status && options.status !== 'all') {
          sql += ` AND ca.status = ?`;
          params.push(options.status);
        }
        sql += ` ORDER BY ca.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rows = await executeQuery<any>(sql, params);

        let countSql = `SELECT COUNT(*) as cnt FROM creator_applications WHERE 1=1`;
        const countParams: any[] = [];
        if (options?.status && options.status !== 'all') {
          countSql += ` AND status = ?`;
          countParams.push(options.status);
        }
        const countRows = await executeQuery<any>(countSql, countParams);
        const total = countRows[0]?.cnt || rows.length;

        const applications: CreatorApplication[] = rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          userUsername: r.username,
          userEmail: r.email,
          userDisplayName: r.display_name,
          portfolioUrl: r.portfolio_url,
          motivation: r.motivation,
          plannedProjects: r.planned_projects,
          plannedContent: r.planned_content,
          status: r.status,
          adminNotes: r.admin_notes,
          reviewedBy: r.reviewed_by,
          reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : undefined,
          createdAt: new Date(r.created_at).toISOString(),
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
        }));

        return { applications, total };
      } catch (err) {
        console.warn('MariaDB creator_applications findAll error:', err);
      }
    }

    let filtered = db.creatorApplications.slice();
    if (options?.status && options.status !== 'all') {
      filtered = filtered.filter((a) => a.status === options.status);
    }
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    // Attach user details
    const populated = await Promise.all(
      paginated.map(async (a) => {
        const u = await userRepository.findById(a.userId);
        return {
          ...a,
          userUsername: u?.username,
          userEmail: u?.email,
          userDisplayName: u?.displayName,
        };
      })
    );

    return { applications: populated, total };
  }

  async review(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reviewedBy: string,
    adminNotes?: string
  ): Promise<CreatorApplication | null> {
    const dbStatus = getLastDatabaseStatus();
    const nowIso = new Date().toISOString();

    if (dbStatus.connected) {
      try {
        await executeQuery(
          `UPDATE creator_applications 
           SET status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_notes = ?, updated_at = NOW() 
           WHERE id = ?`,
          [status, reviewedBy, adminNotes || null, id]
        );
      } catch (err) {
        console.warn('MariaDB creator_applications review error:', err);
      }
    }

    const app = db.creatorApplications.find((a) => a.id === id);
    if (app) {
      app.status = status;
      app.reviewedBy = reviewedBy;
      app.reviewedAt = nowIso;
      app.adminNotes = adminNotes;
      app.updatedAt = nowIso;
      return app;
    }

    // Try reloading if not in memory
    const loaded = await this.findAll({ limit: 100 });
    return loaded.applications.find((a) => a.id === id) || null;
  }
}

export const creatorApplicationRepository = new CreatorApplicationRepository();
