import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { AuditLog, ApiEndpointLog } from '../models/types';
import { db } from '../db';

export class AuditRepository {
  async log(action: string, userId: string, username: string, details: string, ip: string): Promise<AuditLog> {
    const entry: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      userId,
      username,
      details,
      ip,
      timestamp: new Date().toISOString(),
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO audit_logs (id, user_id, username, action, details, ip, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [entry.id, entry.userId, entry.username, entry.action, entry.details, entry.ip, entry.timestamp]
        );
      } catch (err) {
        console.warn('MariaDB audit log insert failed:', err);
      }
    }

    db.auditLogs.unshift(entry);
    return entry;
  }

  async getAuditLogs(options?: {
    limit?: number;
    page?: number;
    action?: string;
    userId?: string;
    search?: string;
  } | number): Promise<{ logs: AuditLog[]; total: number } | AuditLog[]> {
    const opts = typeof options === 'number' ? { limit: options } : (options || {});
    const limit = Math.min(opts.limit || 50, 100);
    const page = Math.max(1, opts.page || 1);
    const offset = (page - 1) * limit;

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        let sql = `SELECT id, user_id as userId, username, action, details, ip, created_at as timestamp FROM audit_logs WHERE 1=1`;
        const params: any[] = [];

        if (opts.action && opts.action !== 'all') {
          sql += ` AND action = ?`;
          params.push(opts.action);
        }
        if (opts.userId) {
          sql += ` AND user_id = ?`;
          params.push(opts.userId);
        }
        if (opts.search) {
          sql += ` AND (details LIKE ? OR username LIKE ? OR action LIKE ?)`;
          const term = `%${opts.search}%`;
          params.push(term, term, term);
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rows = await executeQuery<any>(sql, params);

        let countSql = `SELECT COUNT(*) as cnt FROM audit_logs WHERE 1=1`;
        const countParams: any[] = [];
        if (opts.action && opts.action !== 'all') {
          countSql += ` AND action = ?`;
          countParams.push(opts.action);
        }
        if (opts.userId) {
          countSql += ` AND user_id = ?`;
          countParams.push(opts.userId);
        }
        if (opts.search) {
          countSql += ` AND (details LIKE ? OR username LIKE ? OR action LIKE ?)`;
          const term = `%${opts.search}%`;
          countParams.push(term, term, term);
        }
        const countRows = await executeQuery<any>(countSql, countParams);
        const total = countRows[0]?.cnt || rows.length;

        if (typeof options === 'number') {
          return rows;
        }
        return { logs: rows, total };
      } catch (err) {
        console.warn('MariaDB getAuditLogs failed:', err);
      }
    }

    let filtered = db.auditLogs.slice();
    if (opts.action && opts.action !== 'all') {
      filtered = filtered.filter((l) => l.action === opts.action);
    }
    if (opts.userId) {
      filtered = filtered.filter((l) => l.userId === opts.userId);
    }
    if (opts.search) {
      const q = opts.search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.details.toLowerCase().includes(q) ||
          l.username.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q)
      );
    }
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    if (typeof options === 'number') {
      return paginated;
    }
    return { logs: paginated, total };
  }

  async logEndpointCheck(endpoint: string, service: string, statusCode: number, responseTimeMs: number, status: 'OPTIMAL' | 'DEGRADED' | 'DOWN'): Promise<void> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const id = `api-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await executeQuery(
          `INSERT INTO api_endpoints_log (id, endpoint, service, status_code, response_time_ms, status, checked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, endpoint, service, statusCode, responseTimeMs, status, new Date().toISOString()]
        );
      } catch (err) {
        console.warn('MariaDB logEndpointCheck failed:', err);
      }
    }
  }

  async getEndpointLogs(): Promise<ApiEndpointLog[]> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT id, endpoint, service, status_code as statusCode, response_time_ms as responseTimeMs, status, checked_at as checkedAt
           FROM api_endpoints_log ORDER BY checked_at DESC LIMIT 20`
        );
        return rows;
      } catch (err) {
        console.warn('MariaDB getEndpointLogs failed:', err);
      }
    }
    return [];
  }
}

export const auditRepository = new AuditRepository();
