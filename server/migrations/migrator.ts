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
  failedMigration?: string;
  message: string;
  error?: string;
}

export const deferredLegacyMigrations = new Set([
  '002_seed_initial_data.sql',
  '004_remove_demo_data.sql',
]);

/**
 * Splits SQL content into executable statements:
 * - Strips single-line comments (-- and #) without discarding subsequent SQL
 * - Strips multi-line comments (/* ... *\/)
 * - Preserves semicolons inside single quotes, double quotes, and backticks
 * - Handles escaped characters and double delimiters ('' or \')
 * - Normalizes CRLF and LF
 * - Ignores USE statements so operations remain bound to the configured pool database
 */
export function splitSqlStatements(sqlContent: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  const len = sqlContent.length;
  let i = 0;

  while (i < len) {
    const char = sqlContent[i];
    const nextChar = i + 1 < len ? sqlContent[i + 1] : '';

    // Handle single-line comments (-- or #)
    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      i++;
      continue;
    }

    // Handle block comments (/* ... */)
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // Handle single-quoted string literal
    if (inSingleQuote) {
      current += char;
      if (char === '\\') {
        if (i + 1 < len) {
          current += sqlContent[i + 1];
          i += 2;
          continue;
        }
      } else if (char === "'") {
        if (nextChar === "'") {
          current += nextChar;
          i += 2;
          continue;
        }
        inSingleQuote = false;
      }
      i++;
      continue;
    }

    // Handle double-quoted string literal
    if (inDoubleQuote) {
      current += char;
      if (char === '\\') {
        if (i + 1 < len) {
          current += sqlContent[i + 1];
          i += 2;
          continue;
        }
      } else if (char === '"') {
        if (nextChar === '"') {
          current += nextChar;
          i += 2;
          continue;
        }
        inDoubleQuote = false;
      }
      i++;
      continue;
    }

    // Handle backtick identifier
    if (inBacktick) {
      current += char;
      if (char === '`') {
        if (nextChar === '`') {
          current += nextChar;
          i += 2;
          continue;
        }
        inBacktick = false;
      }
      i++;
      continue;
    }

    // Comment starters outside quotes
    if (char === '-' && nextChar === '-') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (char === '#') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    // Quote starters
    if (char === "'") {
      inSingleQuote = true;
      current += char;
      i++;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      i++;
      continue;
    }

    if (char === '`') {
      inBacktick = true;
      current += char;
      i++;
      continue;
    }

    // Semicolon statement terminator
    if (char === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        // Filter out redundant USE statements since connection is already bound
        if (!/^USE\s+/i.test(trimmed)) {
          statements.push(trimmed);
        }
      }
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  // Trailing statement without trailing semicolon
  const finalTrimmed = current.trim();
  if (finalTrimmed.length > 0 && !/^USE\s+/i.test(finalTrimmed)) {
    statements.push(finalTrimmed);
  }

  return statements;
}

/**
 * Executes database migrations in deterministic alphanumeric order.
 * 
 * Important MariaDB Architecture Note:
 * DDL statements (CREATE TABLE, ALTER TABLE, DROP TABLE, etc.) in MariaDB / MySQL
 * trigger an implicit COMMIT. Therefore, DDL cannot be rolled back inside a transaction.
 * Each migration file is executed statement-by-statement. A migration is ONLY marked
 * as applied in `_nexus_migrations` after ALL its statements have succeeded.
 */
export async function runMigrations(): Promise<MigrationResult> {
  const dbHealth = await testDatabaseConnection();
  if (!dbHealth.connected) {
    return {
      success: false,
      applied: [],
      deferred: [],
      message: 'MariaDB ist nicht erreichbar. Migrationen wurden nicht ausgeführt.',
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

    // Read migration SQL files in sorted order
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
        const statements = splitSqlStatements(sqlContent);

        const connection = await pool.getConnection();
        try {
          // Execute each statement in sequence
          for (let idx = 0; idx < statements.length; idx++) {
            const statement = statements[idx];
            if (statement.length > 0) {
              await connection.query(statement);
            }
          }

          // Record migration ONLY if all statements completed without throwing
          await connection.query(
            `INSERT INTO _nexus_migrations (migration_name) VALUES (?)`,
            [file]
          );
          appliedMigrations.push(file);
        } catch (err: any) {
          // Failure handling: note that DDL may have implicitly committed previous statements
          console.error(`[Migrations] Fehler bei Migration "${file}": ${err.message}`);
          return {
            success: false,
            applied: appliedMigrations,
            deferred: deferredMigrations,
            failedMigration: file,
            message: `Migration fehlgeschlagen bei "${file}": ${err.message}. Hinweis: In MariaDB verursachen DDL-Anweisungen implizite Commits.`,
            error: err.message,
          };
        } finally {
          connection.release();
        }
      }
    }

    const messages: string[] = [];
    if (appliedMigrations.length > 0) {
      messages.push(`${appliedMigrations.length} Migration(en) erfolgreich angewendet.`);
    } else {
      messages.push('Datenbankschema ist auf dem neuesten Stand.');
    }
    if (deferredMigrations.length > 0) {
      messages.push(`Zurückgestellte Legacy-Dateien (nicht automatisch ausgeführt): ${deferredMigrations.join(', ')}.`);
    }

    return {
      success: true,
      applied: appliedMigrations,
      deferred: deferredMigrations,
      message: messages.join(' '),
    };
  } catch (err: any) {
    return {
      success: false,
      applied: appliedMigrations,
      deferred: deferredMigrations,
      message: `Fehler bei der Migrationsprüfung: ${err.message}`,
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
      error: `MariaDB ist nicht erreichbar (${dbHealth.diagnosticCode}).`,
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
