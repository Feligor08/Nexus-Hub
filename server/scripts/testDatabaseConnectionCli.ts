import dotenv from 'dotenv';
import { verifyDatabaseSchema, testDatabaseConnection, closeDbPool } from '../config/database';
import { getMigrationStatus } from '../migrations/migrator';

dotenv.config();

async function runDatabaseConnectivityCheck() {
  console.log('====================================================');
  console.log('   NEXUS CODE PLAY — MARIADB CONNECTIVITY AUDIT     ');
  console.log('====================================================');
  console.log(`Target Host:     ${process.env.DB_HOST || '127.0.0.1'}`);
  console.log(`Target Port:     ${process.env.DB_PORT || 3306}`);
  console.log(`Database Name:   ${process.env.DB_NAME || 'nexus_code_play'}`);
  console.log(`User:            ${process.env.DB_USER || 'root'}`);
  console.log(`Connect Timeout: ${process.env.DB_CONNECT_TIMEOUT || 5000}ms`);
  console.log('----------------------------------------------------');

  try {
    const rawStatus = await testDatabaseConnection(true);
    console.log(`[TCP Probe & Ping]   Result: ${rawStatus.connected ? 'OK' : 'FAILED'}`);
    console.log(`[Diagnostic Code]    ${rawStatus.diagnosticCode}`);

    if (!rawStatus.connected) {
      console.error('\n[FEHLER] Verbindung zu MariaDB konnte nicht hergestellt werden.');
      switch (rawStatus.diagnosticCode) {
        case 'DB_PORT_UNREACHABLE':
          console.error('Hinweis: Der Host ist erreichbar, aber Port 3306 lehnt Verbindungen ab.');
          console.error('Prüfe, ob MariaDB läuft: sudo systemctl status mariadb');
          break;
        case 'DB_HOST_UNREACHABLE':
          console.error('Hinweis: Der konfigurierte DB_HOST ist über das Netzwerk nicht erreichbar.');
          console.error('Prüfe DNS-Auflösung oder Tailscale-Verbindungsstatus (tailscale status).');
          break;
        case 'DB_AUTH_FAILED':
          console.error('Hinweis: Benutzername oder Passwort wurden von MariaDB abgelehnt.');
          console.error('Prüfe DB_USER und DB_PASSWORD in der .env-Datei.');
          break;
        case 'DB_NOT_FOUND':
          console.error('Hinweis: Die angegebene Datenbank existiert nicht.');
          console.error('Erstelle sie mit: CREATE DATABASE IF NOT EXISTS nexus_code_play CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
          break;
        case 'DB_PERMISSION_DENIED':
          console.error('Hinweis: Der Benutzer hat keine ausreichenden Berechtigungen.');
          break;
        default:
          console.error(`Hinweis: Diagnostic Code ${rawStatus.diagnosticCode}`);
          console.error('Prüfe die MariaDB-Logs unter /var/log/mysql/error.log.');
      }
      await closeDbPool();
      process.exit(1);
    }

    console.log(`[Engine Version]     ${rawStatus.type} (Latenz: ${rawStatus.latencyMs}ms)`);

    // Schema and tables check
    const schema = await verifyDatabaseSchema();
    console.log(`[Tabellen Vorhanden] ${schema.tablesFound.length} von ${schema.tablesFound.length + schema.missingTables.length}`);

    if (schema.missingTables.length > 0) {
      console.warn(`[Fehlende Tabellen]  ${schema.missingTables.join(', ')}`);
      console.warn('Führe Migrationen aus: npm run db:migrate');
    } else {
      console.log('[Schema-Integrität]  Alle Kern-Tabellen sind vorhanden.');
    }

    // Check migration state if available
    try {
      const migStatus = await getMigrationStatus();
      console.log(`[Migrationen]        ${migStatus.applied.length} angewendet, ${migStatus.pending.length} ausstehend.`);
      if (migStatus.pending.length > 0) {
        console.warn(`Ausstehende Migrationen: ${migStatus.pending.join(', ')}`);
        console.warn('Empfehlung: Führe "npm run db:migrate" aus.');
      }
    } catch {
      // Ignored if migrations table not queried
    }

    console.log('----------------------------------------------------');
    console.log('STATUS: ERFOLGREICH — MariaDB ist betriebsbereit.');
    console.log('====================================================');
    await closeDbPool();
    process.exit(0);
  } catch (err: any) {
    console.error('\n[Unerwarteter Fehler]', err.message);
    await closeDbPool();
    process.exit(1);
  }
}

runDatabaseConnectivityCheck();
