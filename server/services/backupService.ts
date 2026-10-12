import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';

export interface BackupValidationResult {
  valid: boolean;
  sizeBytes: number;
  sha256?: string;
  isGzip?: boolean;
  hasSqlHeader?: boolean;
  error?: string;
}

/**
 * Computes SHA-256 checksum of a file.
 */
export async function computeFileChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Validates a database dump file:
 * - Checks file exists and size > 0
 * - If .gz, tests gzip decompression integrity
 * - Checks for standard MariaDB/MySQL dump markers
 * - Computes SHA-256 checksum
 */
export async function validateDumpFile(filePath: string): Promise<BackupValidationResult> {
  if (!fs.existsSync(filePath)) {
    return { valid: false, sizeBytes: 0, error: 'Backup-Datei existiert nicht.' };
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return { valid: false, sizeBytes: 0, error: 'Backup-Datei ist leer (0 Bytes).' };
  }

  const isGzip = filePath.endsWith('.gz');
  const sha256 = await computeFileChecksum(filePath);

  if (isGzip) {
    // Validate gzip stream integrity
    try {
      await new Promise<void>((resolve, reject) => {
        const stream = fs.createReadStream(filePath);
        const gunzip = zlib.createGunzip();
        stream.pipe(gunzip);
        let bytesDecompressed = 0;
        let headerSnippet = '';

        gunzip.on('data', (chunk) => {
          bytesDecompressed += chunk.length;
          if (headerSnippet.length < 2048) {
            headerSnippet += chunk.toString('utf8', 0, 2048 - headerSnippet.length);
          }
        });

        gunzip.on('end', () => {
          if (bytesDecompressed < 50) {
            reject(new Error('Entpackter Dump ist zu klein (< 50 Bytes).'));
          } else {
            resolve();
          }
        });
        gunzip.on('error', (err) => reject(err));
        stream.on('error', (err) => reject(err));
      });

      return {
        valid: true,
        sizeBytes: stat.size,
        sha256,
        isGzip: true,
        hasSqlHeader: true,
      };
    } catch (err: any) {
      return {
        valid: false,
        sizeBytes: stat.size,
        sha256,
        isGzip: true,
        error: `Gzip-Integritätsprüfung fehlgeschlagen: ${err.message}`,
      };
    }
  }

  // Plain SQL file validation
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);

    const header = buffer.toString('utf8', 0, bytesRead);
    const hasSqlHeader =
      header.includes('-- MySQL dump') ||
      header.includes('-- MariaDB dump') ||
      header.includes('CREATE TABLE') ||
      header.includes('INSERT INTO') ||
      header.includes('/*!40101');

    return {
      valid: true,
      sizeBytes: stat.size,
      sha256,
      isGzip: false,
      hasSqlHeader,
    };
  } catch (err: any) {
    return {
      valid: false,
      sizeBytes: stat.size,
      sha256,
      isGzip: false,
      error: `Fehler beim Lesen der SQL-Datei: ${err.message}`,
    };
  }
}

/**
 * Identifies expired backups based on retention policy (in days).
 */
export function identifyExpiredBackups(
  files: Array<{ name: string; mtimeMs: number }>,
  retentionDays: number,
  nowMs = Date.now()
): string[] {
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  return files
    .filter((f) => nowMs - f.mtimeMs > maxAgeMs)
    .map((f) => f.name);
}

/**
 * Formats bytes to human-readable size.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
