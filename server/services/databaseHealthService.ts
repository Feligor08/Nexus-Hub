import { testDatabaseConnection, DatabaseStatus } from '../config/database';
import { auditRepository } from '../repositories/auditRepository';

let cachedHealth: { success: boolean; database: DatabaseStatus; timestamp: number } | null = null;

export class DatabaseHealthService {
  async checkHealth(forceRefresh = false): Promise<{ success: boolean; database: DatabaseStatus }> {
    const now = Date.now();
    if (!forceRefresh && cachedHealth && now - cachedHealth.timestamp < 10000) {
      return {
        success: cachedHealth.success,
        database: cachedHealth.database,
      };
    }

    const status = await testDatabaseConnection();

    // Log the health check into api_endpoints_log
    try {
      await auditRepository.logEndpointCheck(
        '/api/health/database',
        'MariaDB',
        status.connected ? 200 : 503,
        status.latencyMs || 0,
        status.connected ? 'OPTIMAL' : 'DOWN'
      );
    } catch (error) {
      console.warn('Database health audit logging failed.');
    }

    const result = {
      success: status.connected,
      database: status,
    };

    cachedHealth = {
      ...result,
      timestamp: now,
    };

    return result;
  }
}

export const databaseHealthService = new DatabaseHealthService();
