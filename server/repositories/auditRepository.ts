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

  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT id, user_id as userId, username, action, details, ip, created_at as timestamp 
           FROM audit_logs ORDER BY created_at DESC LIMIT ?`,
          [limit]
        );
        return rows;
      } catch (err) {
        console.warn('MariaDB getAuditLogs failed:', err);
      }
    }
    return db.auditLogs.slice(0, limit);
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
