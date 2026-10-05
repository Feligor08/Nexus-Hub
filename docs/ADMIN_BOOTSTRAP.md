# NEXUS CODE PLAY — ADMIN BOOTSTRAP ANLEITUNG

## 1. Überblick
Der Admin-Bootstrap ist ein sicherer, serverseitiger CLI-Befehl zur einmaligen Einrichtung oder Wiederherstellung des primären Plattform-Administrators. 
Er ist **nicht über öffentliche HTTP-Endpunkte zugänglich** und verhindert unbefugte Rechteerweiterungen im Produktivbetrieb.

## 2. Voraussetzungen
- Node.js 22 LTS / TSX Laufzeitumgebung
- Verbindung zur MariaDB 11-Datenbank (HP EliteDesk 800 G3 Mini) oder Ausführung im Applikationsverzeichnis
- Zugriff auf die Server-Shell / SSH-Konsole

## 3. Ausführung des Bootstrap-Befehls
Führe auf dem Server im Projektverzeichnis folgenden Befehl aus:

```bash
npm run admin:bootstrap
```

## 4. Interaktive Abfragen
Der Wizard fragt interaktiv folgende Pflichtfelder ab:
1. **Admin E-Mail-Adresse:** z.B. `fschlueter08@gmail.com`
2. **Admin Benutzername:** z.B. `feligor08`
3. **Anzeigename:** z.B. `Felix Schlüter`
4. **Sicheres Admin-Passwort:** Mindestens 8 Zeichen (wird mit bcrypt Salt 12 sicher gehasht)

## 5. Verhalten bei bestehenden Konten
- Falls das Konto bereits existiert, verlangt das Skript eine explizite Bestätigung (`j/N`).
- Nach Bestätigung wird das Passwort aktualisiert und die Rollen `ADMIN`, `CREATOR`, `MODERATOR`, `USER` werden in `user_roles` zugewiesen.
- Es werden zu keinem Zeitpunkt Passwörter im Klartext ausgegeben oder in Logs gespeichert.

## 6. Audit & Protokollierung
Jeder Bootstrap-Vorgang schreibt einen revisionssicheren Eintrag in die `audit_logs` Tabelle:
- Aktion: `ADMIN_BOOTSTRAP`
- Details: Bestätigung der Rechtezuweisung
- IP: `127.0.0.1` (lokaler Host-Aufruf)

## 7. Fehlerbehebung
- **MariaDB offline:** Das Skript warnt bei Verbindungsverlust und aktualisiert die Session im Speicher. Starte MariaDB auf dem Host (`sudo systemctl start mariadb` oder Docker-Container) und führe den Befehl erneut aus.
- **Passwort vergessen:** Führe `npm run admin:bootstrap` erneut aus, wähle denselben Benutzernamen und vergebe ein neues Passwort.
