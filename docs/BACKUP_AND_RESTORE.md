# NEXUS CODE PLAY — BACKUP & DISASTER RECOVERY HANDBUCH (SPRINT 10)

## 1. Übersicht & Zielsetzungen

- **Primäre Produktionsdomain:** `https://www.fs-nexus-systems.de`
- **Host-System:** HP EliteDesk 800 G3 Mini (Ubuntu Server 24.04 LTS, CasaOS / Docker)
- **Datenbank:** MariaDB 11 (utf8mb4_unicode_ci)
- **Medienspeicher:** Lokales Dateisystem (`/var/nexus/storage` bzw. `MEDIA_STORAGE_PATH`)
- **Recovery Point Objective (RPO):** Maximal 24 Stunden (automatische tägliche Dumps) bzw. 0 Stunden vor manuellen Schema-Migrationen.
- **Recovery Time Objective (RTO):** Unter 15 Minuten für vollständige Wiederherstellung von DB und Medien.

---

## 2. Backup-Architektur & Speicherorte

| Komponente | Quelle | Zielverzeichnis | Format | Häufigkeit |
|---|---|---|---|---|
| **MariaDB** | `nexus_code_play` | `/var/nexus/backups/database/` | `nexus_db_<TIMESTAMP>.sql.gz` + `.sha256` | Täglich 03:00 Uhr + vor Migrationen |
| **Media Storage** | `/var/nexus/storage/` | `/var/nexus/backups/media/` | `nexus_media_<TIMESTAMP>.tar.gz` + `.sha256` | Täglich 03:30 Uhr |

### Sicherheits- & Konsistenzregeln
1. **Transaktionale Konsistenz:** MariaDB-Dumps werden ausschließlich mit `--single-transaction --quick --routines --triggers --events --hex-blob` erstellt. Dadurch werden laufende Lese- und Schreiboperationen nicht blockiert.
2. **Kompression & Integrität:** Jeder Dump wird mit gzip komprimiert, unmittelbar danach per `gzip -t` getestet und mit einer SHA-256 Prüfsumme gesichert.
3. **Keine Klartextpasswörter:** Passwörter werden niemals in Prozesslisten (`ps aux`) offengelegt. Das Skript nutzt `MYSQL_PWD` intern in geschützten Subshells.
4. **Aufbewahrungsrichtlinie (Retention Policy):** Backups werden standardmäßig 14 Tage aufbewahrt (`BACKUP_RETENTION_DAYS=14`). Ältere Dumps werden automatisch rotiert.

---

## 3. Ausführung von Backups

### Manuelles Backup (z.B. vor Updates oder Migrationen)
```bash
# Im Projektverzeichnis ausführen:
bash server/scripts/backup.sh
```

Ausgabebeispiel:
```text
==========================================================
 [2026-10-12T03:00:00+02:00] STARTING NEXUS CODE PLAY BACKUP
==========================================================
Host:       127.0.0.1:3306
Database:   nexus_code_play
User:       nexus_app
Backup Dir: /var/nexus/backups
Retention:  14 Tage
----------------------------------------------------------
[1/3] Erstelle konsistenten MariaDB-Dump...
[2/3] Verifiziere Integrität des Dumps...
  -> Dump erfolgreich: nexus_db_20261012_030000.sql.gz (1.4M)
  -> SHA-256 Checksum: a8f4c2...
[3/3] Sichere Media Storage (/var/nexus/storage)...
  -> Media-Backup erfolgreich: nexus_media_20261012_030000.tar.gz (42M)
----------------------------------------------------------
Bereinige Backups älter als 14 Tage...
==========================================================
 [2026-10-12T03:00:15+02:00] BACKUP ERFOLGREICH ABGESCHLOSSEN
==========================================================
```

### Integritätsprüfung über Node.js CLI
```bash
# Integrität und Checksumme einer bestimmten Backup-Datei prüfen:
npm run backup verify /var/nexus/backups/database/nexus_db_20261012_030000.sql.gz

# Vorhandene Backups und Dateigrößen auflisten:
npm run backup list /var/nexus/backups/database/
```

---

## 4. Automatisierung per Cronjob oder Systemd Timer

### Option A: Crontab (Empfohlen)
Als root oder dedizierter Wartungsbenutzer eintragen (`crontab -e`):
```cron
# Täglich um 03:00 Uhr: Nexus MariaDB & Media Storage Backup
0 3 * * * /bin/bash /var/nexus/app/server/scripts/backup.sh >> /var/log/nexus/backup.log 2>&1
```

### Option B: Systemd Service & Timer
Datei `/etc/systemd/system/nexus-backup.service`:
```ini
[Unit]
Description=Nexus Code Play Backup Service
After=network.target mariadb.service

[Service]
Type=oneshot
User=nexus
WorkingDirectory=/var/nexus/app
ExecStart=/bin/bash /var/nexus/app/server/scripts/backup.sh
StandardOutput=append:/var/log/nexus/backup.log
StandardError=append:/var/log/nexus/backup.log
```

Datei `/etc/systemd/system/nexus-backup.timer`:
```ini
[Unit]
Description=Nexus Code Play Daily Backup Timer

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Aktivieren mit:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nexus-backup.timer
```

---

## 5. Wiederherstellung (Disaster Recovery & Restore)

Das Skript `server/scripts/restore.sh` bietet einen kontrollierten Wiederherstellungspfad mit Schutz vor versehentlichem Überschreiben.

### Fall 1: Test-Wiederherstellung in eine separate Staging-Datenbank (Ohne Risiko)
Zur regelmäßigen Verifikation, dass Backups lauffähig sind:
```bash
bash server/scripts/restore.sh \
  /var/nexus/backups/database/nexus_db_20261012_030000.sql.gz \
  --target-db nexus_restore_verify \
  --force
```

### Fall 2: Vollständige Wiederherstellung im Notfall (Produktion)
```bash
# 1. Nexus Server stoppen
pm2 stop nexus-code-play
# oder: sudo systemctl stop nexus-code-play

# 2. Restore ausführen (erfordert explizite Bestätigung mit 'JA')
bash server/scripts/restore.sh \
  /var/nexus/backups/database/nexus_db_20261012_030000.sql.gz \
  --media-tar /var/nexus/backups/media/nexus_media_20261012_030000.tar.gz

# 3. Datenbankverbindung und Tabellen prüfen
npm run db:check

# 4. Nexus Server wieder starten
pm2 start nexus-code-play
# oder: sudo systemctl start nexus-code-play

# 5. Health Check prüfen
curl -s http://127.0.0.1:3000/api/health
```

---

## 6. Notfall-Checkliste bei Totalausfall (Bare Metal Recovery)

1. **Neuen Server bereitstellen:** Ubuntu 24.04 LTS installieren und Tailscale einbinden.
2. **MariaDB 11 installieren:**
   ```bash
   sudo apt update && sudo apt install -y mariadb-server mariadb-client
   sudo mysql_secure_installation
   ```
3. **Benutzer anlegen:**
   ```sql
   CREATE DATABASE nexus_code_play CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'nexus_app'@'%' IDENTIFIED BY '<SicheresPasswort>';
   GRANT SELECT, INSERT, UPDATE, DELETE ON nexus_code_play.* TO 'nexus_app'@'%';
   FLUSH PRIVILEGES;
   ```
4. **Code klonen & Abhängigkeiten einrichten:**
   ```bash
   git clone <REPO_URL> /var/nexus/app
   cd /var/nexus/app
   npm ci
   npm run build
   ```
5. **Backups einspielen:**
   ```bash
   bash server/scripts/restore.sh /backup/nexus_db_latest.sql.gz --media-tar /backup/nexus_media_latest.tar.gz --force
   ```
6. **Verbindung validieren:**
   ```bash
   npm run db:check
   ```
7. **Service starten:**
   ```bash
   pm2 start ecosystem.config.cjs --env production
   ```
