# NEXUS CODE PLAY — PLATFORM & MARIADB ARCHITECTURE

> **Full-Stack Developer Platform, AI Workspace & Systems Portfolio**  
> Zielumgebung: HP EliteDesk 800 G3 Mini (Ubuntu Server 24.04 LTS, CasaOS, Docker, MariaDB 11, Tailscale, Nginx Proxy Manager).

---

## 1. Systemarchitektur & Layer-Trennung

Nexus Code Play trennt das React-Frontend strikt von der Datenbank:

```
[ Clients ]
   ├── React Web SPA (Liquid Glass Monochrom)
   ├── C# .NET 10 WPF Desktop Suite (HttpClient API)
   ├── Java Applications (Spring / REST)
   └── n8n Automation Workflows (Monitoring & Backup)
          │
          ▼ HTTPS / REST (/api & /api/v1)
[ Express TS Gateway & Controllers ]
          │
          ▼
[ Service Layer ] (Business Logic, Validation & Transactions)
          │
          ▼
[ Repository Layer ] (Prepared Statements, Schema Mapping, Failover)
          │
          ▼ Connection Pool (mysql2/promise)
[ MariaDB 11 ] (InnoDB, utf8mb4, Port 3306 auf HP EliteDesk 800 G3 Mini)
```

**Sicherheitsregel**: Das React-Frontend kommuniziert **ausschließlich** über die serverseitige REST-API (`/api/*`). Keine Datenbankpasswörter oder MariaDB-Verbindungsdaten gelangen in den Browser-Build.

---

## 2. Environment Variables (.env)

Kopiere `.env.example` nach `.env`:

```bash
cp .env.example .env
```

| Variable | Beschreibung | Standard |
|---|---|---|
| `PORT` | Express Server Port | `3000` |
| `DB_HOST` | Hostname/IP des MariaDB Servers (z.B. Tailscale IP) | `127.0.0.1` |
| `DB_PORT` | MariaDB Port | `3306` |
| `DB_NAME` | Datenbankname | `nexus_code_play` |
| `DB_USER` | Dedizierter Anwendungsbenutzer (**nicht** root!) | `nexus_app` |
| `DB_PASSWORD` | Sicheres Datenbankpasswort | `your-secure-password` |
| `DB_POOL_MIN` | Minimale Poolverbindungen | `2` |
| `DB_POOL_MAX` | Maximale Poolverbindungen | `10` |
| `GEMINI_API_KEY` | Google Gemini API Key für serverseitige KI-Routen | `MY_GEMINI_API_KEY` |

---

## 3. MariaDB Einrichtung auf dem HP EliteDesk Mini (Docker)

### A. Dedizierter Anwendungsbenutzer (`nexus_app`)
Führe auf der MariaDB als Administrator/Root einmalig aus:

```sql
-- Datenbank erstellen
CREATE DATABASE IF NOT EXISTS nexus_code_play
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Least-Privilege Benutzer anlegen (KEIN Root!)
CREATE USER IF NOT EXISTS 'nexus_app'@'%' IDENTIFIED BY 'DEIN_SICHERES_PASSWORT';

-- Nur die benötigten DML- und DDL-Rechte auf nexus_code_play gewähren
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, REFERENCES 
ON nexus_code_play.* TO 'nexus_app'@'%';

FLUSH PRIVILEGES;
```

---

## 4. Datenbank-Migrationen

Migrationsdateien liegen unter `server/migrations/`:
- `001_initial_schema.sql`: Normalisierte Tabellen für Users, Roles, User_Roles, Projects, Technologies, Products, Orders, Carts, Community, Notifications, AI_Conversations, API_Endpoints_Log und Audit_Logs.
- `002_seed_initial_data.sql`: Seed für Standardrollen, Entwickler-Profil (@feligor08), echte Projekt-Blueprints und Produkte.

### Migration ausführen:
1. **Automatisch beim Serverstart**: Wenn MariaDB online ist, führt der Server ausstehende Migrationen automatisch via Transaktion aus.
2. **Über die Web-Administration**: Im Admin Panel unter *Infrastruktur & MariaDB* auf *"Schema Migrationen anwenden"* klicken (`POST /api/database/migrate`).
3. **Manuell via CLI**:
```bash
mysql -h 127.0.0.1 -P 3306 -u nexus_app -p nexus_code_play < server/migrations/001_initial_schema.sql
mysql -h 127.0.0.1 -P 3306 -u nexus_app -p nexus_code_play < server/migrations/002_seed_initial_data.sql
```

---

## 5. API-Endpunkte (REST / Version 1)

Alle Endpunkte sind sowohl unter `/api/*` als auch versioniert unter `/api/v1/*` erreichbar:

### System & Health
- `GET /api/health`: Plattform-Status, Service-Topologie & MariaDB Status.
- `GET /api/health/database`: MariaDB Latenz & Verbindungsdiagnose.
- `POST /api/database/migrate`: Führt ausstehende SQL-Migrationen aus.

### Portfolio & Systeme
- `GET /api/projects`: Liste aller Projekte (unterstützt `?category=`, `?search=`, `?page=`, `?limit=`).
- `GET /api/projects/featured`: Kuratierte Featured Systems.
- `GET /api/projects/:slug`: Detail-Datensatz einer Case Study.

### Store & Checkout
- `GET /api/products`: Digitale Vorlagen, Docker Bundles & 3D STL Modelle.
- `GET /api/cart`: Persistenter Benutzer-Warenkorb.
- `POST /api/checkout`: Transaktionsgesicherter Checkout (Order & Order Items Snapshot).

### AI Workspace & Persistente Historie
- `GET /api/ai/conversations`: Liste gespeicherter Chat-Sessions des Benutzers.
- `POST /api/ai/conversations`: Neue Konversation anlegen.
- `GET /api/ai/conversations/:id/messages`: Chat-Verlauf abrufen.
- `POST /api/ai/conversations/:id/messages`: Nachricht persistent speichern.
- `POST /api/chat`: Gemini Multi-Turn Rollen-Chatbot.
- `POST /api/analyze-code`: 5-Stufen Debugger (Prinzip 23).

---

## 6. Multi-Client Integration (C# WPF & Java)

### C# .NET 10 WPF Beispiel
In C# Desktop-Anwendungen greifst du über den REST-Endpunkt zu, ohne DB-Credentials in Desktop-Apps zu kompromittieren:

```csharp
using System.Net.Http.Json;

public class NexusApiClient
{
    private readonly HttpClient _http = new() { BaseAddress = new Uri("http://localhost:3000/api/v1/") };

    public async Task<List<ProjectDto>> GetProjectsAsync()
    {
        var response = await _http.GetFromJsonAsync<ApiResponse<List<ProjectDto>>>("projects");
        return response?.Data ?? new();
    }
}
```

---

## 7. Automatisierte Backup-Strategie

Backups laufen auf dem HP EliteDesk Mini via Cronjob oder n8n:

### Empfohlener Cronjob (`/etc/cron.d/nexus_backup`):
```cron
# Täglich um 02:00 Uhr sichern
0 2 * * * root /opt/nexus/scripts/backup_mariadb.sh >/dev/null 2>&1
```

### Backup-Skript (`backup_mariadb.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/mnt/storage/backups/mariadb/daily"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

# Sichere mysqldump Ausführung mit gzip Kompression
mysqldump -u nexus_app -p"$DB_PASSWORD" nexus_code_play | gzip > "$BACKUP_DIR/nexus_code_play_$TIMESTAMP.sql.gz"

# Retention: Lösche Backups älter als 7 Tage
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -delete
```
*Aufbewahrungsfristen: Daily (7 Tage), Weekly (4 Wochen), Monthly (6 Monate).*
