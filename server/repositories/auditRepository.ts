import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { AuditLog, ApiEndpointLog } from '../models/types';

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

    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Audit-Log konnte nicht gespeichert werden.');
    }
    await executeQuery(
      `INSERT INTO audit_logs (id, user_id, username, action, details, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.userId, entry.username, entry.action, entry.details, entry.ip, entry.timestamp]
    );
    return entry;
  }

  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Audit-Logs sind derzeit nicht verfügbar.');
    }
    return executeQuery<any>(
      `SELECT id, user_id as userId, username, action, details, ip, created_at as timestamp
       FROM audit_logs ORDER BY created_at DESC LIMIT ?`,
      [Math.min(Math.max(limit, 1), 100)]
    );
  }

  async logEndpointCheck(endpoint: string, service: string, statusCode: number, responseTimeMs: number, status: 'OPTIMAL' | 'DEGRADED' | 'DOWN'): Promise<void> {
    if (!getLastDatabaseStatus().connected) return;
    const id = `api-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await executeQuery(
      `INSERT INTO api_endpoints_log (id, endpoint, service, status_code, response_time_ms, status, checked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, endpoint, service, statusCode, responseTimeMs, status, new Date().toISOString()]
    );
  }

  async getEndpointLogs(): Promise<ApiEndpointLog[]> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Endpoint-Logs sind derzeit nicht verfügbar.');
    }
    return executeQuery<any>(
      `SELECT id, endpoint, service, status_code as statusCode, response_time_ms as responseTimeMs, status, checked_at as checkedAt
       FROM api_endpoints_log ORDER BY checked_at DESC LIMIT 20`
    );
  }
}

export const auditRepository = new AuditRepository();
