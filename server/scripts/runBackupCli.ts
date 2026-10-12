import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { validateDumpFile, formatBytes, computeFileChecksum } from '../services/backupService';

dotenv.config();

/**
 * CLI utility to inspect and verify backup files or list existing backups.
 * Usage:
 *   npx tsx server/scripts/runBackupCli.ts verify <filepath>
 *   npx tsx server/scripts/runBackupCli.ts list [backupDir]
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('====================================================');
  console.log('    NEXUS CODE PLAY — BACKUP INTEGRITY UTILITY      ');
  console.log('====================================================');

  if (command === 'verify') {
    const targetFile = args[1];
    if (!targetFile) {
      console.error('[FEHLER] Bitte Pfad zur Backup-Datei angeben.');
      console.error('Beispiel: npm run backup verify /var/nexus/backups/nexus_db_20261012.sql.gz');
      process.exit(1);
    }

    console.log(`Prüfe Datei: ${targetFile}`);
    const res = await validateDumpFile(targetFile);

    if (res.valid) {
      console.log('STATUS:        GÜLTIG [OK]');
      console.log(`Größe:         ${formatBytes(res.sizeBytes)} (${res.sizeBytes} Bytes)`);
      console.log(`Format:        ${res.isGzip ? 'GZIP-komprimiert' : 'Plain SQL'}`);
      console.log(`SHA-256:       ${res.sha256}`);
      console.log('Integrität:    Vollständig intakt und dekomprimierbar.');
      process.exit(0);
    } else {
      console.error('STATUS:        UNZULÄSSIG / BESCHÄDIGT [FEHLER]');
      console.error(`Fehlerursache: ${res.error}`);
      process.exit(1);
    }
  } else if (command === 'list') {
    const backupDir = args[1] || process.env.BACKUP_DIR || path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      console.log(`Backup-Verzeichnis existiert nicht: ${backupDir}`);
      process.exit(0);
    }

    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sql.gz') || f.endsWith('.sql') || f.endsWith('.tar.gz'));
    console.log(`Verzeichnis: ${backupDir}`);
    console.log(`Gefundene Backups: ${files.length}\n`);

    for (const f of files) {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      console.log(`- ${f.padEnd(40)} ${formatBytes(stat.size).padStart(10)}  ${stat.mtime.toISOString()}`);
    }
    process.exit(0);
  } else {
    console.log('Verfügbare Befehle:');
    console.log('  npm run backup verify <pfad-zu-dump>   - Validiert Dateigröße, Gzip-Stream und SHA-256');
    console.log('  npm run backup list [verzeichnis]      - Listet alle vorhandenen Backups auf');
    console.log('\nFür automatisierte Backups auf dem Ubuntu-Server verwende:');
    console.log('  bash server/scripts/backup.sh');
    console.log('  bash server/scripts/restore.sh <dump-datei>');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[Unerwarteter Fehler]', err);
  process.exit(1);
});
