import dotenv from 'dotenv';
import { runMigrations } from '../migrations/migrator';
import { testDatabaseConnection } from '../config/database';

dotenv.config();

async function main() {
  console.log('================================================================');
  console.log(' NEXUS CODE PLAY — DATABASE MIGRATION CLI');
  console.log('================================================================\n');

  console.log('[1/2] Prüfe MariaDB-Verbindung...');
  const health = await testDatabaseConnection(true);
  if (!health.connected) {
    console.error(`[FEHLER] MariaDB ist nicht erreichbar: ${health.diagnosticCode}`);
    console.error('Bitte stelle sicher, dass der MariaDB-Dienst aktiv und über DB_HOST erreichbar ist.');
    process.exit(1);
  }

  console.log(`[Database] Verbunden mit MariaDB (${health.database} @ ${health.host}) mit ${health.latencyMs}ms Latenz.\n`);
  console.log('[2/2] Führe anstehende Migrationen aus...');

  const result = await runMigrations();
  if (result.success) {
    console.log(`\n[ERFOLG] ${result.message}`);
    if (result.applied.length > 0) {
      console.log('Neu angewandte Migrationen:');
      result.applied.forEach((m) => console.log(`  ✓ ${m}`));
    } else {
      console.log('Das Datenbankschema ist bereits auf dem neuesten Stand.');
    }
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error(`\n[FEHLER] Migration fehlgeschlagen: ${result.error || result.message}`);
    console.log('================================================================\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Fatal Error]:', err.message);
  process.exit(1);
});
