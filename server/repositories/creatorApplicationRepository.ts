import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { CreatorApplication } from '../models/types';

export class CreatorApplicationRepository {
  private requireDatabase(): void {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Creator-Anträge sind derzeit nicht verfügbar.');
    }
  }

  async findByUserId(userId: string): Promise<CreatorApplication | null> {
    this.requireDatabase();
    const rows = await executeQuery<any>(
      `SELECT * FROM creator_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (!rows.length) return null;
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

  async findById(id: string): Promise<CreatorApplication | null> {
    this.requireDatabase();
    const rows = await executeQuery<any>(
      `SELECT * FROM creator_applications WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return null;
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

  async create(data: {
    userId: string;
    portfolioUrl?: string;
    motivation: string;
    plannedProjects: string;
    plannedContent: string;
  }): Promise<CreatorApplication> {
    this.requireDatabase();
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

    return newApp;
  }

  async findAll(options?: { status?: string; page?: number; limit?: number }): Promise<{
    applications: CreatorApplication[];
    total: number;
  }> {
    this.requireDatabase();
    const limit = Math.min(options?.limit || 20, 100);
    const page = Math.max(1, options?.page || 1);
    const offset = (page - 1) * limit;

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
  }

  async review(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reviewedBy: string,
    adminNotes?: string
  ): Promise<CreatorApplication | null> {
    this.requireDatabase();
    await executeQuery(
      `UPDATE creator_applications 
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_notes = ?, updated_at = NOW() 
       WHERE id = ?`,
      [status, reviewedBy, adminNotes || null, id]
    );

    return this.findById(id);
  }
}

export const creatorApplicationRepository = new CreatorApplicationRepository();

