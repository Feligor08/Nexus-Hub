import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import {
  computeFileChecksum,
  formatBytes,
  identifyExpiredBackups,
  validateDumpFile,
} from './backupService';

const tempFiles: string[] = [];

afterEach(() => {
  tempFiles.forEach((file) => {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      // ignore
    }
  });
  tempFiles.length = 0;
});

describe('Backup Service & Integrity Verification', () => {
  it('formats byte numbers into human-readable strings', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(5242880)).toBe('5 MB');
  });

  it('computes correct SHA-256 checksum for a file', async () => {
    const tempFile = path.join(os.tmpdir(), `test-checksum-${Date.now()}.txt`);
    tempFiles.push(tempFile);
    fs.writeFileSync(tempFile, 'Nexus Code Play Backup Test', 'utf8');

    const checksum = await computeFileChecksum(tempFile);
    expect(checksum).toBeDefined();
    expect(checksum.length).toBe(64);
  });

  it('validates a valid gzipped dump file', async () => {
    const tempFile = path.join(os.tmpdir(), `valid-dump-${Date.now()}.sql.gz`);
    tempFiles.push(tempFile);

    const dumpContent = '-- MariaDB dump 11.2\nCREATE TABLE test_users (id INT);\nINSERT INTO test_users VALUES (1);\n';
    const compressed = zlib.gzipSync(Buffer.from(dumpContent, 'utf8'));
    fs.writeFileSync(tempFile, compressed);

    const result = await validateDumpFile(tempFile);
    expect(result.valid).toBe(true);
    expect(result.isGzip).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.sha256).toBeDefined();
  });

  it('detects a corrupt gzip file', async () => {
    const tempFile = path.join(os.tmpdir(), `corrupt-dump-${Date.now()}.sql.gz`);
    tempFiles.push(tempFile);

    // Corrupted gzip data
    fs.writeFileSync(tempFile, Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xde, 0xad, 0xbe, 0xef]));

    const result = await validateDumpFile(tempFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Gzip-Integritätsprüfung fehlgeschlagen');
  });

  it('detects an empty 0-byte file', async () => {
    const tempFile = path.join(os.tmpdir(), `empty-dump-${Date.now()}.sql`);
    tempFiles.push(tempFile);
    fs.writeFileSync(tempFile, '');

    const result = await validateDumpFile(tempFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('leer');
  });

  it('identifies expired backups according to retention policy', () => {
    const now = 1000000000000;
    const dayMs = 24 * 60 * 60 * 1000;
    const files = [
      { name: 'backup-1.sql.gz', mtimeMs: now - 2 * dayMs },  // 2 days old
      { name: 'backup-2.sql.gz', mtimeMs: now - 6 * dayMs },  // 6 days old
      { name: 'backup-3.sql.gz', mtimeMs: now - 10 * dayMs }, // 10 days old
      { name: 'backup-4.sql.gz', mtimeMs: now - 30 * dayMs }, // 30 days old
    ];

    const expired7Days = identifyExpiredBackups(files, 7, now);
    expect(expired7Days).toEqual(['backup-3.sql.gz', 'backup-4.sql.gz']);

    const expired3Days = identifyExpiredBackups(files, 3, now);
    expect(expired3Days).toEqual(['backup-2.sql.gz', 'backup-3.sql.gz', 'backup-4.sql.gz']);
  });
});
