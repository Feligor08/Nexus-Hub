# NEXUS CODE PLAY — ADMIN BOOTSTRAP ANLEITUNG (SPRINT 9)

## 1. Überblick
Der Admin-Bootstrap ist ein sicheres, serverseitiges CLI-Verfahren zur kontrollierten Ersteinrichtung oder Aktualisierung des primären Plattform-Administrators. 
Er ist **nicht über öffentliche HTTP-Endpunkte zugänglich** und verhindert unbefugte Rechteerweiterungen im Produktivbetrieb.

## 2. Vorgesehene Administrator-Identität
- **Benutzername:** `FelixFocus08`
- **Anzeigename:** `FelixFocus08`
- **E-Mail-Adresse:** `fschlueter08@gmail.com`
- **Rolle:** `ADMIN`

## 3. Sicherheitsregeln & Passwortanforderungen
- **Mindestlänge:** Mindestens 12 Zeichen.
- **Passwort-Hashing:** Ausschließlich serverseitig mit `bcryptjs` (Salt Rounds: 12).
- **Kein Klartext:** Passwörter werden zu keinem Zeitpunkt im Klartext in der Datenbank, in Logdateien, im Frontend, in Git oder in der Shell-Historie gespeichert.
- **Keine Hardcodes:** Es gibt keinen fest einprogrammierten Passwort-Fallback.
- **Kein In-Memory-Fallback:** Der Bootstrap erfordert eine aktive Verbindung zu MariaDB, damit das Konto persistent und sicher gespeichert wird.
- **Revisionssicheres Audit:** Jede Ausführung schreibt einen Audit-Log-Eintrag (`ADMIN_BOOTSTRAP`), ohne Passwörter oder Geheimnisse offenzulegen.
- **Konfliktschutz:** Sollte bereits ein Konto mit abweichender E-Mail oder abweichendem Benutzernamen existieren, bricht das Verfahren sicher ab, um eine fehlerhafte Übernahme fremder Konten auszuschließen.

---

## 4. Ausführung durch den Betreiber

### Option A: Interaktive Eingabe (Empfohlen für manuelle Einrichtung)
Führe auf dem Server im Projektverzeichnis folgenden Befehl aus:

```bash
npm run admin:bootstrap
```

Der Wizard fragt die Parameter interaktiv ab (mit sicheren Standardvorschlägen):
1. **Admin E-Mail:** Standard `fschlueter08@gmail.com` (oder Enter zum Bestätigen)
2. **Admin Benutzername:** Standard `FelixFocus08` (oder Enter zum Bestätigen)
3. **Anzeigename:** Standard `FelixFocus08` (oder Enter zum Bestätigen)
4. **Sicheres Admin-Passwort:** Mindestens 12 Zeichen (wird verdeckt bzw. sicher abgefragt)

### Option B: Non-Interaktive Ausführung (Automatisierung / CI)
Übergebe das Passwort über die Umgebungsvariable `ADMIN_BOOTSTRAP_PASSWORD`:

```bash
ADMIN_BOOTSTRAP_PASSWORD="DeinGeheimesAdminPasswort123!" npm run admin:bootstrap
```

*Hinweis:* Nach Ausführung sollte die Shell-Historie bereinigt werden (`history -c` bzw. Variable unmaskiert nicht persistieren).

---

## 5. Idempotentes Verhalten & Konfliktbehandlung
- **Neues Konto:** Wenn weder E-Mail noch Benutzername existieren, wird das Konto mit Rolle `ADMIN`, Status `ACTIVE` und Badges neu in MariaDB angelegt.
- **Bestehendes übereinstimmendes Konto:** Wenn das Konto bereits mit übereinstimmendem Benutzernamen und E-Mail existiert, wird das Passwort sicher aktualisiert, die Rolle `ADMIN` sichergestellt und der Status auf `ACTIVE` gesetzt.
- **Widersprüchliche Konten:** Weicht der Benutzername oder die E-Mail von einem vorhandenen Konto ab, bricht das Skript mit Status `CONFLICT` ab, ohne Daten zu verändern.

---

## 6. Nach der ersten Anmeldung
1. Rufe die Plattform auf (`https://www.fs-nexus-systems.de` oder lokal).
2. Melde dich mit `FelixFocus08` oder `fschlueter08@gmail.com` und dem gesetzten Passwort an.
3. Öffne das Profil und setze bei Bedarf ein neues, ausschließlich für diesen Zweck genutztes Passwort.
