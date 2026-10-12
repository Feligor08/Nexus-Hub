# NEXUS CODE PLAY — PRODUCTION SETUP, DEPLOYMENT & OPERATION GUIDE (SPRINT 9)

## 1. Zielarchitektur & Infrastruktur

- **Produktionsdomäne:** `https://www.fs-nexus-systems.de`
- **Host-System:** HP EliteDesk 800 G3 Mini (Ubuntu Server 24.04 LTS, CasaOS / Docker)
- **Netzwerk:** Tailscale WireGuard Mesh-VPN (kein öffentliches Routing von Datenbank-Ports!)
- **Reverse Proxy:** Nginx Proxy Manager (Let's Encrypt TLS-Zertifikate, HTTPS-Zwang, HTTP/2)
- **Anwendungs-Laufzeit:** Node.js 22 LTS / tsx Full-Stack Express Server (Port 3000)
- **Datenbank:** MariaDB 11.x (dedizierter unprivilegierter DB-Nutzer, nicht root)
- **Dateispeicher:** Privates Verzeichnis außerhalb des Web-Roots (`MEDIA_STORAGE_PATH`)

---

## 2. Benötigte Environment-Variablen (Namen ohne Werte)

Folgende Variablen müssen in der Produktionsumgebung (`.env` auf dem Server oder Docker-Environment) definiert werden:

| Variablenname | Beschreibung |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Port für Express-Server (Standard: `3000`) |
| `APP_URL` | Öffentliche Basis-URL: `https://www.fs-nexus-systems.de` |
| `SESSION_SECRET` | Kryptografisch zufälliger String zur Sitzungssignierung (Zwingend erforderlich in Produktion) |
| `JWT_SECRET` | Kryptografisch zufälliger Signaturschlüssel (Zwingend erforderlich in Produktion; kein unsicherer Fallback) |
| `DB_HOST` | Host oder Tailscale-IP des MariaDB-Servers (z.B. `100.x.x.x` oder `127.0.0.1`) |
| `DB_PORT` | MariaDB-Port (Standard: `3306`) |
| `DB_NAME` | Datenbankname (z.B. `nexus_code_play`) |
| `DB_USER` | Dedizierter unprivilegierter Datenbankbenutzer (z.B. `nexus_app`) |
| `DB_PASSWORD` | Sicheres Datenbankpasswort |
| `DB_POOL_MIN` | Minimale Pool-Verbindungen (Standard: `2`) |
| `DB_POOL_MAX` | Maximale Pool-Verbindungen (Standard: `10`) |
| `DB_CONNECT_TIMEOUT` | Verbindungstimeout in Millisekunden (Standard: `5000`) |
| `MEDIA_STORAGE_PATH` | Absoluter oder relativer privater Pfad für Mediendateien (z.B. `/var/nexus/storage`) |
| `GEMINI_API_KEY` | Serverseitiger Google Gemini API-Schlüssel für KI-Funktionen |
| `AUTO_MIGRATE` | Optional (`false` in Produktion; Migrationen via CLI empfohlen) |

*Sicherheitshinweis:* Die `.env`-Datei darf niemals in Git eingecheckt werden (`.gitignore` erzwingt dies). Verwende ausschließlich `.env.example` als Vorlage.

---

## 3. Datenbankverbindung & Netzwerkanforderungen

1. **Keine öffentlichen Ports:** Der Port `3306` darf unter keinen Umständen über die öffentliche Firewall freigegeben werden.
2. **Tailscale / Privates Netz:** Der Zugriff zwischen Anwendungs-Server und separatem MariaDB-Host erfolgt über das interne Tailscale-Interface (IP `100.x.x.x`) oder über ein lokales Docker-Netzwerk (`bridge`/`overlay`).
3. **Initiale Datenbankerstellung & Berechtigungen (DBA-Einrichtung):**
   Die Datenbankerstellung und Benutzerberechtigung erfolgt einmalig durch den Datenbankadministrator. Die Anwendungs-Migrationen setzen keine globalen Administratorrechte voraus.
   ```sql
   -- Einmalige administrative Einrichtung durch Root/DBA:
   CREATE DATABASE IF NOT EXISTS nexus_code_play CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'nexus_app'@'%' IDENTIFIED BY '<SicheresPasswort>';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON nexus_code_play.* TO 'nexus_app'@'%';
   FLUSH PRIVILEGES;
   ```
4. **Verbindungspooling:** Der Verbindungsaufbau nutzt ein Keepalive-fähiges Pool-Management (`mysql2/promise`) mit automatischer Reconnect-Behandlung und 2000ms TCP-Timeout-Drosselung bei Netzausfall.

---

## 4. Dateispeicher (Media Storage) & Berechtigungen

- Mediendateien und Downloads werden unter dem in `MEDIA_STORAGE_PATH` definierten Pfad abgelegt.
- Dieser Ordner liegt **außerhalb** des statischen Web-Roots (`dist/`).
- Dateien werden ausschließlich unter UUID-basierten Schlüsseln gespeichert (Path-Traversal-Schutz).
- Auslieferung geschieht nur über den autorisierten Endpunkt `/api/media/:id/file` bzw. `/api/downloads/file/:token`.
- Erforderliche Dateisystem-Berechtigungen auf dem Server:
  ```bash
  mkdir -p /var/nexus/storage
  chown -R node:node /var/nexus/storage
  chmod 750 /var/nexus/storage
  ```

---

## 5. Build, Migration & Start

```bash
# 1. Abhängigkeiten installieren
npm ci

# 2. Produktions-Build erstellen (Vite Frontend SPA)
npm run build

# 3. MariaDB-Verbindung und Schema verifizieren
npm run db:check

# 4. Datenbank-Migrationen kontrolliert ausführen
npm run db:migrate

# 5. Ersten Administrator einrichten (falls noch nicht vorhanden)
npm run admin:bootstrap

# 6. Produktions-Server starten
npm run start
```

Für den Dauerbetrieb wird PM2 mit der vorhandenen Konfigurationsdatei empfohlen:
```bash
# Start mit PM2 Ecosystem
pm2 start ecosystem.config.cjs --env production

# Status prüfen & Autostart bei Serverneustart einrichten
pm2 status
pm2 save
pm2 startup
```

Alternativ über Systemd (`/etc/systemd/system/nexus-code-play.service`):
```ini
[Unit]
Description=Nexus Code Play Full-Stack Platform
After=network.target mariadb.service

[Service]
Type=simple
User=nexus
WorkingDirectory=/var/nexus/app
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

---

## 6. HTTPS & Reverse Proxy (Nginx Proxy Manager)

In Nginx Proxy Manager konfigurieren:
- **Domain Names:** `www.fs-nexus-systems.de`, `fs-nexus-systems.de`
- **Forward Hostname / IP:** `127.0.0.1` (oder Tailscale-IP des App-Servers)
- **Forward Port:** `3000`
- **SSL:**
  - Let's Encrypt Certificate
  - Force SSL: Aktiviert
  - HTTP/2 Support: Aktiviert
  - HSTS: Aktiviert
- **Websockets Support:** Aktiviert (für HMR in Dev / Streaming-API)

---

## 7. Health Checks & Überwachung

Das System stellt strukturierte, nicht-blockierende Health-Endpunkte bereit:

- `GET /api/health`: Liefert den Systemzustand von API, MariaDB, Speicher und KI.
- `GET /api/health/database`: Liefert den detaillierten Verbindungs- und Latenzstatus von MariaDB.
- `GET /api/admin/system-health`: Erweiterte Infrastrukturprüfung (nur für Administratoren).

*Wichtig:* Health-Endpunkte geben niemals Passwörter, Hashes, Session-Tokens oder interne Server-Pfade aus. Bei Ausfall der Datenbank antwortet der Endpunkt mit Status 200 und Feld `database: "DISCONNECTED"`, ohne den Server-Thread zu blockieren.

---

## 8. Backup & Wiederherstellung

Für detaillierte Anweisungen siehe das vollständige Handbuch: **`docs/BACKUP_AND_RESTORE.md`**.

### Automatisiertes Backup ausführen:
```bash
bash server/scripts/backup.sh
```

### Backup-Integrität prüfen:
```bash
npm run backup verify /var/nexus/backups/database/nexus_db_YYYYMMDD_HHMMSS.sql.gz
```

### Wiederherstellung (Restore):
```bash
bash server/scripts/restore.sh /var/nexus/backups/database/nexus_db_YYYYMMDD_HHMMSS.sql.gz
```

---

## 9. Update & Rollback-Verfahren

### Update-Ablauf:
1. Backup der Datenbank und des Media Storage anlegen (siehe Punkt 8).
2. Neuesten Code auschecken: `git pull origin main`.
3. Abhängigkeiten aktualisieren: `npm ci`.
4. Frontend neu bauen: `npm run build`.
5. Migrationen anwenden: `npm run db:migrate`.
6. Anwendung neu starten: `pm2 restart nexus-platform`.
7. Health-Check prüfen: `curl -s https://www.fs-nexus-systems.de/api/health`.

### Rollback-Ablauf:
1. Vorherigen Git-Commit auschecken: `git checkout <PREVIOUS_COMMIT>`.
2. Frontend neu bauen: `npm run build`.
3. Falls Migrationsänderungen inkompatibel sind, Backup-Dump wieder einspielen.
4. Anwendung neu starten: `pm2 restart nexus-platform`.
