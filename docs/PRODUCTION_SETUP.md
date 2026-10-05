# NEXUS CODE PLAY — PRODUCTION SETUP & DEPLOYMENT GUIDE

## 1. Architekturübersicht
- **Hardware Host:** HP EliteDesk 800 G3 Mini (Intel Core i5, 16 GB RAM, NVMe SSD)
- **Betriebssystem:** Ubuntu Server 24.04 LTS (CasaOS Dashboard)
- **Netzwerk & VPN:** Tailscale WireGuard Mesh-VPN (keine offenen Router-Ports)
- **Datenbank:** MariaDB 11.x (Containerized / Local Service auf Port 3306)
- **Reverse Proxy:** Nginx Proxy Manager mit automatisierter Let's Encrypt TLS-Terminierung
- **Backend:** Node.js Express mit REST API (`/api` und `/api/v1`)
- **Frontend:** React 19 SPA mit Tailwind CSS v4 und Liquid Glass Design

## 2. Umgebungskonfiguration (.env)
Erstelle eine sichere `.env`-Datei auf dem Server:

```env
NODE_ENV=production
PORT=3000

# MariaDB Konfiguration (Nur serverseitig!)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=nexus_code_play
DB_USER=nexus_app
DB_PASSWORD=DeinSicheresMariaDBPasswort

# Session & Sicherheit
SESSION_SECRET=EinZufalligerLangerSchluesselFuerSignierung

# Google Gemini API
GEMINI_API_KEY=DeinGeminiApiKey
```

## 3. MariaDB Initialisierung & Migrationen
Das System führt beim Serverstart automatisch alle ausstehenden SQL-Dateien aus `/server/migrations/` aus:
- `001_initial_schema.sql`: Grundtabellen für Benutzer, Rollen, Projekte, Produkte, Warenkörbe, Bestellungen
- `002_seed_initial_data.sql`: System-Rollen und Basiskategorien
- `003_auth_sessions.sql`: Sitzungs- und Audit-Log-Tabellen
- `004_remove_demo_data.sql`: Selektive Bereinigung der ursprünglichen Seed-Testdaten
- `005_content_management.sql`: Status-Lifecycle (`DRAFT`, `PUBLISHED`, `ARCHIVED`), Medien und Entitlements

## 4. Admin Bootstrap
Nach dem ersten Start das primäre Administratorkonto initialisieren:

```bash
npm run admin:bootstrap
```

## 5. Build & Ausführung
```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Frontend bauen (Vite)
npm run build

# 3. Server starten (Full-Stack Express auf Port 3000)
npm run start
```

## 6. Sicherheit & Zugriffsregeln
- **Preis-Sicherheit:** Alle Produktpreise und Gesamtbeträge werden serverseitig in `cartRepository` und `apiRoutes` validiert. Der Client kann Preise nicht manipulieren.
- **Transaktionssicherheit:** Bestellungen und Snapshots werden in MariaDB-Transaktionen (`withTransaction`) gespeichert.
- **Download-Tokens:** Produktdateien liegen niemals ungeschützt im statischen Web-Root. Downloads erfordern einen serverseitig verifizierten, zeitlich begrenzten Token (`/api/downloads/file/:token`).
- **RBAC:** Administratoren haben Zugriff auf `/admin`, Creator auf `/creator`, Benutzer auf ihr `/dashboard` und ihre Einkäufe.
