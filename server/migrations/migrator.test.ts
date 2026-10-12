import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  splitSqlStatements,
  deferredLegacyMigrations,
  runMigrations,
} from './migrator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock database connection for isolation
const mockConnection = {
  query: vi.fn(),
  release: vi.fn(),
};

const mockPool = {
  query: vi.fn(),
  getConnection: vi.fn(() => Promise.resolve(mockConnection)),
};

vi.mock('../config/database', () => ({
  getDbPool: () => mockPool,
  testDatabaseConnection: vi.fn(() => Promise.resolve({ connected: true })),
}));

describe('Migration Runner & SQL Splitter Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. SQL Splitter Regression Tests (Fixing Comment Discard Bug)', () => {
    it('preserves SQL statements preceded by single-line comments (--)', () => {
      const sql = `
-- 1. Create User Sessions table for server-side stateful session governance
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(64) PRIMARY KEY,
  token_hash VARCHAR(128) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- 2. Ensure users table has last_login_at
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL;
`;
      const statements = splitSqlStatements(sql);

      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain('CREATE TABLE IF NOT EXISTS user_sessions');
      expect(statements[0]).not.toContain('-- 1. Create User Sessions');
      expect(statements[1]).toBe('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL');
    });

    it('correctly handles Windows CRLF (\\r\\n) and Unix LF (\\n) line breaks', () => {
      const sqlCrlf = '-- Heading comment\r\nCREATE TABLE crlf_test (\r\n  id INT PRIMARY KEY\r\n);\r\n-- Second comment\r\nALTER TABLE crlf_test ADD col INT;\r\n';
      const statements = splitSqlStatements(sqlCrlf);

      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain('CREATE TABLE crlf_test');
      expect(statements[1]).toContain('ALTER TABLE crlf_test ADD col INT');
    });

    it('handles multiple consecutive comments and empty lines without dropping SQL', () => {
      const sql = `
-- ============================================================
-- SECTION 1: USER ACCOUNTS
-- Author: DevOps Team
-- ============================================================

CREATE TABLE accounts (id INT);

-- End of section
`;
      const statements = splitSqlStatements(sql);
      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('CREATE TABLE accounts (id INT)');
    });

    it('strips block comments (/* ... */) and hash comments (#)', () => {
      const sql = `
/* Multi-line block comment
   explaining the table */
CREATE TABLE block_test (id INT);

# Hash comment
INSERT INTO block_test VALUES (1);
`;
      const statements = splitSqlStatements(sql);
      expect(statements).toHaveLength(2);
      expect(statements[0]).toBe('CREATE TABLE block_test (id INT)');
      expect(statements[1]).toBe('INSERT INTO block_test VALUES (1)');
    });

    it('preserves semicolons within string literals without splitting them', () => {
      const sql = `
INSERT INTO settings (key, value) VALUES ('format', 'text/html; charset=utf-8');
INSERT INTO logs (entry) VALUES ('Statement 1; Statement 2; Statement 3');
`;
      const statements = splitSqlStatements(sql);
      expect(statements).toHaveLength(2);
      expect(statements[0]).toBe("INSERT INTO settings (key, value) VALUES ('format', 'text/html; charset=utf-8')");
      expect(statements[1]).toBe("INSERT INTO logs (entry) VALUES ('Statement 1; Statement 2; Statement 3')");
    });

    it('preserves semicolons within multiline strings and handles escaped quotes', () => {
      const sql = `
INSERT INTO documentation (content) VALUES (
  'Step 1: Run build;\\nStep 2: Start server;\\nDone!'
);
INSERT INTO quotes (phrase) VALUES ('It\\'s; a quote');
`;
      const statements = splitSqlStatements(sql);
      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain("'Step 1: Run build;\\nStep 2: Start server;\\nDone!'");
      expect(statements[1]).toContain("'It\\'s; a quote'");
    });

    it('filters out redundant USE statements so queries stay bound to pool database', () => {
      const sql = `
USE nexus_code_play;
CREATE TABLE isolated_test (id INT);
USE other_db;
`;
      const statements = splitSqlStatements(sql);
      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe('CREATE TABLE isolated_test (id INT)');
    });

    it('returns empty array when file contains only comments and whitespace', () => {
      const sql = `
-- Just a comment
-- Another comment
/* Block comment */
`;
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual([]);
    });
  });

  describe('2. Parsing All Real Repository Migrations', () => {
    const migrationFiles = fs
      .readdirSync(__dirname)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    it('finds and can parse every existing .sql migration file', () => {
      expect(migrationFiles.length).toBeGreaterThanOrEqual(10);
    });

    it('correctly parses 001_initial_schema.sql into core table definitions', () => {
      const content = fs.readFileSync(path.join(__dirname, '001_initial_schema.sql'), 'utf-8');
      const statements = splitSqlStatements(content);

      expect(statements.length).toBeGreaterThan(15);
      const creates = statements.filter((s) => s.toUpperCase().startsWith('CREATE TABLE'));
      expect(creates.length).toBeGreaterThanOrEqual(15);
      // Ensures no CREATE DATABASE was emitted
      expect(statements.some((s) => s.toUpperCase().includes('CREATE DATABASE'))).toBe(false);
      // Ensures no USE statement was emitted
      expect(statements.some((s) => s.toUpperCase().startsWith('USE '))).toBe(false);
    });

    it('correctly parses 003_auth_sessions.sql without dropping tables due to comments', () => {
      const content = fs.readFileSync(path.join(__dirname, '003_auth_sessions.sql'), 'utf-8');
      const statements = splitSqlStatements(content);

      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain('CREATE TABLE IF NOT EXISTS user_sessions');
      expect(statements[1]).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at');
    });

    it('correctly parses 005_content_management.sql without dropping media tables', () => {
      const content = fs.readFileSync(path.join(__dirname, '005_content_management.sql'), 'utf-8');
      const statements = splitSqlStatements(content);

      expect(statements.length).toBeGreaterThanOrEqual(6);
      expect(statements.some((s) => s.includes('media_files'))).toBe(true);
      expect(statements.some((s) => s.includes('product_versions'))).toBe(true);
      expect(statements.some((s) => s.includes('download_entitlements'))).toBe(true);
    });

    it('correctly parses 006_creator_and_account.sql and 006_project_cms_fields.sql without conflicts', () => {
      const creatorContent = fs.readFileSync(path.join(__dirname, '006_creator_and_account.sql'), 'utf-8');
      const projectContent = fs.readFileSync(path.join(__dirname, '006_project_cms_fields.sql'), 'utf-8');

      const creatorStmts = splitSqlStatements(creatorContent);
      const projectStmts = splitSqlStatements(projectContent);

      expect(creatorStmts.some((s) => s.includes('creator_applications'))).toBe(true);
      expect(creatorStmts.some((s) => s.includes('location'))).toBe(true);

      expect(projectStmts.some((s) => s.includes('project_gallery_images'))).toBe(true);
      expect(projectStmts.some((s) => s.includes('case_study_goal'))).toBe(true);
    });

    it('correctly parses 007, 008, 009 and 010 migrations', () => {
      const stmts07 = splitSqlStatements(fs.readFileSync(path.join(__dirname, '007_product_media_foundation.sql'), 'utf-8'));
      const stmts08 = splitSqlStatements(fs.readFileSync(path.join(__dirname, '008_system_reference_data.sql'), 'utf-8'));
      const stmts09 = splitSqlStatements(fs.readFileSync(path.join(__dirname, '009_user_profile_fields.sql'), 'utf-8'));
      const stmts10 = splitSqlStatements(fs.readFileSync(path.join(__dirname, '010_community_reports.sql'), 'utf-8'));

      expect(stmts07.length).toBeGreaterThan(0);
      expect(stmts08.length).toBeGreaterThan(0);
      expect(stmts09.length).toBeGreaterThan(0);
      expect(stmts10.length).toBeGreaterThan(0);
      expect(stmts10[0]).toContain('community_reports');
    });
  });

  describe('3. Execution & Safety Controls', () => {
    it('defers 002_seed_initial_data.sql and 004_remove_demo_data.sql from automatic execution', () => {
      expect(deferredLegacyMigrations.has('002_seed_initial_data.sql')).toBe(true);
      expect(deferredLegacyMigrations.has('004_remove_demo_data.sql')).toBe(true);
    });

    it('handles SQL execution errors by reporting failure and not recording failed migration', async () => {
      // Mock existing migrations
      mockPool.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT migration_name')) {
          return [[{ migration_name: '001_initial_schema.sql' }]];
        }
        return [{ affectedRows: 0 }];
      });

      // Mock connection failure on a specific statement
      mockConnection.query.mockImplementation(async (stmt: string) => {
        if (stmt.includes('user_sessions')) {
          throw new Error('Table already locked by another process');
        }
        return [{ affectedRows: 0 }];
      });

      const result = await runMigrations();

      expect(result.success).toBe(false);
      expect(result.failedMigration).toBe('003_auth_sessions.sql');
      expect(result.error).toContain('Table already locked');
      expect(result.message).toContain('003_auth_sessions.sql');
      // Verify the failed migration was NOT inserted into _nexus_migrations
      expect(mockConnection.query).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO _nexus_migrations'),
        ['003_auth_sessions.sql']
      );
    });
  });
});
