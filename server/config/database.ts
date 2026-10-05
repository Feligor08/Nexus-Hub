import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { lookup } from 'dns/promises';
import { createConnection } from 'net';
import { config } from './env';

export type DatabaseDiagnosticCode =
  | 'DB_NOT_CHECKED'
  | 'DB_HOST_NOT_CONFIGURED'
  | 'DB_HOST_UNREACHABLE'
  | 'DB_PORT_UNREACHABLE'
  | 'DB_AUTH_FAILED'
  | 'DB_NOT_FOUND'
  | 'DB_PERMISSION_DENIED'
  | 'DB_CONNECTION_FAILED'
  | 'DB_CONNECTED';

export interface DatabaseStatus {
  connected: boolean;
  status: 'connected' | 'degraded';
  diagnosticCode: DatabaseDiagnosticCode;
  type: string;
  host: string;
  database: string;
  latencyMs?: number;
  checkedAt: string;
}

let pool: Pool | null = null;
let lastKnownStatus: DatabaseStatus = {
  connected: false,
  status: 'degraded',
  diagnosticCode: 'DB_NOT_CHECKED',
  type: 'MariaDB',
  host: config.db.host,
  database: config.db.database,
  checkedAt: new Date().toISOString(),
};

function classifyNetworkError(error: NodeJS.ErrnoException): DatabaseDiagnosticCode {
  if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN' || error.code === 'EHOSTUNREACH' || error.code === 'ENETUNREACH') {
    return 'DB_HOST_UNREACHABLE';
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT') {
    return 'DB_PORT_UNREACHABLE';
  }
  return 'DB_CONNECTION_FAILED';
}

function classifyMysqlError(error: unknown): DatabaseDiagnosticCode {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'ER_ACCESS_DENIED_ERROR' || code === 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR') return 'DB_AUTH_FAILED';
  if (code === 'ER_BAD_DB_ERROR') return 'DB_NOT_FOUND';
  if (code === 'ER_DBACCESS_DENIED_ERROR' || code === 'ER_TABLEACCESS_DENIED_ERROR' || code === 'ER_COLUMNACCESS_DENIED_ERROR') {
    return 'DB_PERMISSION_DENIED';
  }
  return classifyNetworkError({ code } as NodeJS.ErrnoException);
}

async function probeTcpConnection(): Promise<DatabaseDiagnosticCode> {
  const host = config.db.host;
  if (!host || host === 'DB_HOST_NOT_CONFIGURED') return 'DB_HOST_NOT_CONFIGURED';
  try {
    await lookup(host);
  } catch (error) {
    return classifyNetworkError(error as NodeJS.ErrnoException);
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeout: NodeJS.Timeout;
    const socket = createConnection({ host, port: config.db.port });
    const finish = (code: DatabaseDiagnosticCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      resolve(code);
    };
    timeout = setTimeout(() => finish('DB_PORT_UNREACHABLE'), config.db.connectTimeout);
    socket.once('connect', () => finish('DB_CONNECTED'));
    socket.once('error', (error: NodeJS.ErrnoException) => finish(classifyNetworkError(error)));
  });
}

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
  const network = await probeTcpConnection();
  if (network !== 'DB_CONNECTED') {
    lastKnownStatus = {
      connected: false,
      status: 'degraded',
      diagnosticCode: network,
      type: 'MariaDB',
      host: config.db.host,
      database: config.db.database,
      checkedAt: new Date().toISOString(),
    };
    return lastKnownStatus;
  }

  try {
    // Test with a direct connection with strict timeout so we never hang indefinitely on unreachable hosts
    const connPromise = mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      connectTimeout: 2000,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out')), 2500)
    );

    const conn = await Promise.race([connPromise, timeoutPromise]);
    const [rows] = await conn.query('SELECT 1 as is_alive, VERSION() as version');
    const latency = Date.now() - start;
    const versionStr = Array.isArray(rows) && (rows[0] as any)?.version ? (rows[0] as any).version : 'MariaDB';
    await conn.end();

    lastKnownStatus = {
      connected: true,
      status: 'connected',
      diagnosticCode: 'DB_CONNECTED',
      type: versionStr.toLowerCase().includes('maria') ? 'MariaDB' : 'MySQL/MariaDB',
      host: config.db.host,
      database: config.db.database,
      latencyMs: latency,
      checkedAt: new Date().toISOString(),
    };
    return lastKnownStatus;
  } catch (err: unknown) {
    lastKnownStatus = {
      connected: false,
      status: 'degraded',
      diagnosticCode: classifyMysqlError(err),
      type: 'MariaDB',
      host: config.db.host,
      database: config.db.database,
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
  const queryPromise = currentPool.execute(sql, params);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('MariaDB executeQuery timed out')), 4000)
  );
  const [rows] = await Promise.race([queryPromise, timeoutPromise]);
  return rows as T[];
}

/**
 * Executes a callback within a managed transaction (BEGIN ... COMMIT / ROLLBACK)
 */
export async function withTransaction<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const currentPool = getDbPool();
  const connPromise = currentPool.getConnection();
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('MariaDB getConnection timed out')), 4000)
  );
  const connection = await Promise.race([connPromise, timeoutPromise]);
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
