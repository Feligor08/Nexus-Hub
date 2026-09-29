import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { config } from './env';

export interface DatabaseStatus {
  connected: boolean;
  type: string;
  host: string;
  database: string;
  latencyMs?: number;
  error?: string;
  checkedAt: string;
}

let pool: Pool | null = null;
let lastKnownStatus: DatabaseStatus = {
  connected: false,
  type: 'MariaDB',
  host: config.db.host,
  database: config.db.database,
  checkedAt: new Date().toISOString(),
};

/**
 * Initializes or retrieves the MariaDB Connection Pool
 */
export function getDbPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: config.db.connectionLimit,
      queueLimit: 0,
      connectTimeout: config.db.connectTimeout,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      dateStrings: true,
    });
  }
  return pool;
}

/**
 * Tests connection to MariaDB and measures round-trip latency
 */
export async function testDatabaseConnection(): Promise<DatabaseStatus> {
  const start = Date.now();
  try {
    const currentPool = getDbPool();
    const [rows] = await currentPool.query('SELECT 1 as is_alive, VERSION() as version');
    const latency = Date.now() - start;
    const versionStr = Array.isArray(rows) && (rows[0] as any)?.version ? (rows[0] as any).version : 'MariaDB';

    lastKnownStatus = {
      connected: true,
      type: versionStr.toLowerCase().includes('maria') ? 'MariaDB' : 'MySQL/MariaDB',
      host: config.db.host,
      database: config.db.database,
      latencyMs: latency,
      checkedAt: new Date().toISOString(),
    };
    return lastKnownStatus;
  } catch (err: any) {
    lastKnownStatus = {
      connected: false,
      type: 'MariaDB',
      host: config.db.host,
      database: config.db.database,
      error: err.code || err.message || 'Connection refused or host unreachable',
      checkedAt: new Date().toISOString(),
    };
    return lastKnownStatus;
  }
}

/**
 * Helper to execute prepared queries safely with parameter binding
 */
export async function executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const currentPool = getDbPool();
  const [rows] = await currentPool.execute(sql, params);
  return rows as T[];
}

/**
 * Executes a callback within a managed transaction (BEGIN ... COMMIT / ROLLBACK)
 */
export async function withTransaction<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const currentPool = getDbPool();
  const connection = await currentPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export function getLastDatabaseStatus(): DatabaseStatus {
  return lastKnownStatus;
}
