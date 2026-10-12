import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbPool, testDatabaseConnection } from '../config/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationResult {
  success: boolean;
  applied: string[];
  deferred: string[];
  message: string;
  error?: string;
}

const deferredLegacyMigrations = new Set([
  '002_seed_initial_data.sql',
  '004_remove_demo_data.sql',
]);

/**
 * Executes database migrations in sequence
 */
export async function runMigrations(): Promise<MigrationResult> {
  const dbHealth = await testDatabaseConnection();
  if (!dbHealth.connected) {
    return {
      success: false,
      applied: [],
      deferred: [],
      message: 'MariaDB is not reachable. Migrations deferred until connection is active.',
      error: dbHealth.diagnosticCode,
    };
  }

  const pool = getDbPool();
  const appliedMigrations: string[] = [];
  const deferredMigrations: string[] = [];

  try {
    // Ensure migrations tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _nexus_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(150) NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Fetch already executed migrations
    const [rows] = await pool.query(`SELECT migration_name FROM _nexus_migrations;`);
    const executed = new Set((rows as any[]).map((r) => r.migration_name));

    // Read migration SQL files
    const files = fs
      .readdirSync(__dirname)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (!executed.has(file) && deferredLegacyMigrations.has(file)) {
        deferredMigrations.push(file);
        continue;
      }
      if (!executed.has(file)) {
        const filePath = path.join(__dirname, file);
        const sqlContent = fs.readFileSync(filePath, 'utf-8');

        // Split into individual SQL statements by semicolon
        const statements = sqlContent
          .split(/;\s*$/m)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));

        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();

          for (const statement of statements) {
            if (statement.length > 0) {
              await connection.query(statement);
            }
          }

          await connection.query(`INSERT INTO _nexus_migrations (migration_name) VALUES (?)`, [file]);
          await connection.commit();
          appliedMigrations.push(file);
        } catch (err) {
          await connection.rollback();
          throw err;
        } finally {
          connection.release();
        }
      }
    }

    return {
      success: true,
      applied: appliedMigrations,
      deferred: deferredMigrations,
      message: [
        appliedMigrations.length > 0 ? `Successfully applied ${appliedMigrations.length} migration(s).` : 'Database schema is up to date.',
        deferredMigrations.length > 0 ? `Deferred legacy migrations pending explicit review: ${deferredMigrations.join(', ')}.` : '',
      ].filter(Boolean).join(' '),
    };
  } catch (err: any) {
    return {
      success: false,
      applied: appliedMigrations,
      deferred: deferredMigrations,
      message: 'Migration execution error',
      error: err.message,
    };
  }
}

export interface MigrationStatusResult {
  connected: boolean;
  applied: string[];
  pending: string[];
  deferred: string[];
  totalFiles: number;
  diagnosticCode?: string;
  error?: string;
}

/**
 * Inspects migration state without running changes (safe pre-flight inspection)
 */
export async function getMigrationStatus(): Promise<MigrationStatusResult> {
  const dbHealth = await testDatabaseConnection();
  if (!dbHealth.connected) {
    return {
      connected: false,
      applied: [],
      pending: [],
      deferred: [],
      totalFiles: 0,
      diagnosticCode: dbHealth.diagnosticCode,
      error: `MariaDB is not reachable (${dbHealth.diagnosticCode}).`,
    };
  }

  const pool = getDbPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _nexus_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(150) NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    const [rows] = await pool.query(`SELECT migration_name FROM _nexus_migrations ORDER BY id ASC;`);
    const executed = new Set((rows as any[]).map((r) => r.migration_name));
    const applied = (rows as any[]).map((r) => r.migration_name);

    const files = fs
      .readdirSync(__dirname)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending: string[] = [];
    const deferred: string[] = [];

    for (const file of files) {
      if (!executed.has(file)) {
        if (deferredLegacyMigrations.has(file)) {
          deferred.push(file);
        } else {
          pending.push(file);
        }
      }
    }

    return {
      connected: true,
      applied,
      pending,
      deferred,
      totalFiles: files.length,
      diagnosticCode: dbHealth.diagnosticCode,
    };
  } catch (err: any) {
    return {
      connected: false,
      applied: [],
      pending: [],
      deferred: [],
      totalFiles: 0,
      diagnosticCode: 'DB_CONNECTION_FAILED',
      error: err.message,
    };
  }
}

