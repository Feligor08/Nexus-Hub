import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { executeQuery, getLastDatabaseStatus, testDatabaseConnection } from '../config/database';
import { userRepository } from '../repositories/userRepository';
import { auditRepository } from '../repositories/auditRepository';

dotenv.config();

async function runBootstrap() {
  console.log('================================================================');
  console.log(' NEXUS CODE PLAY — PRODUCTION ADMIN BOOTSTRAP WIZARD');
  console.log('================================================================\n');

  const rl = readline.createInterface({ input, output });

  try {
    const dbStatus = await testDatabaseConnection();
    if (dbStatus.connected) {
      console.log(`[Database] MariaDB status: CONNECTED (${dbStatus.latencyMs}ms)\n`);
    } else {
      console.log(`[Database] MariaDB status: DISCONNECTED (${dbStatus.error || 'Offline'}).`);
      console.log('Warning: Creating local fallback admin. To persist to MariaDB, ensure MariaDB is running.\n');
    }

    const email = (await rl.question('1. Admin E-Mail-Adresse: ')).trim();
    if (!email || !email.includes('@')) {
      console.error('Fehler: Ungültige E-Mail-Adresse.');
      process.exit(1);
    }

    const username = (await rl.question('2. Admin Benutzername (z.B. feligor08): ')).trim();
    if (!username || username.length < 3) {
      console.error('Fehler: Benutzername muss mindestens 3 Zeichen lang sein.');
      process.exit(1);
    }

    const displayName = (await rl.question('3. Anzeigename (z.B. Felix Schlüter): ')).trim();
    if (!displayName) {
      console.error('Fehler: Anzeigename darf nicht leer sein.');
      process.exit(1);
    }

    const password = (await rl.question('4. Sicheres Admin-Passwort (mindestens 12 Zeichen): ')).trim();
    if (!password || password.length < 12) {
      console.error('Fehler: Passwort muss mindestens 12 Zeichen lang sein.');
      process.exit(1);
    }

    console.log('\n[Bootstrap] Überprüfe Benutzerkonto...');
    const existing = await userRepository.findWithCredentials(email) || await userRepository.findWithCredentials(username);

    if (existing) {
      console.log(`\nEin Benutzer mit E-Mail oder Benutzername "${existing.username}" existiert bereits.`);
      const confirm = (await rl.question('Möchtest du diesem bestehenden Konto die ADMIN-Rolle zuweisen und das Passwort aktualisieren? (j/N): ')).trim().toLowerCase();
      
      if (confirm !== 'j' && confirm !== 'ja' && confirm !== 'y' && confirm !== 'yes') {
        console.log('Abbruch durch Benutzer. Keine Änderungen vorgenommen.');
        process.exit(0);
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      if (dbStatus.connected) {
        await executeQuery(
          `UPDATE users SET password_hash = ?, display_name = ?, status = 'ACTIVE' WHERE id = ?`,
          [passwordHash, displayName || existing.displayName, existing.id]
        );
      }
      await userRepository.updateRole(existing.id, 'ADMIN');
      await auditRepository.log('ADMIN_BOOTSTRAP', existing.id, existing.username, 'Admin-Rolle via CLI-Bootstrap zugewiesen', '127.0.0.1');

      console.log('\n================================================================');
      console.log(' ERFOLG: Bestehendes Konto wurde zum ADMINISTRATOR heraufgestuft.');
      console.log(` Benutzer: ${existing.username} (${existing.email})`);
      console.log(' Rolle: ADMIN (Vollzugriff auf Admin Panel & Systemmetriken)');
      console.log('================================================================\n');
    } else {
      // Create new user
      const id = `usr-admin-${Date.now()}`;
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      const newUser = await userRepository.createUser({
        id,
        username,
        email,
        displayName,
        passwordHash,
        bio: 'Platform Administrator · Nexus Code Play Core Engine',
      });

      await userRepository.updateRole(id, 'ADMIN');
      await auditRepository.log('ADMIN_BOOTSTRAP', id, username, 'Neues Administrator-Konto via CLI-Bootstrap initialisiert', '127.0.0.1');

      console.log('\n================================================================');
      console.log(' ERFOLG: Administrator-Konto erfolgreich initialisiert.');
      console.log(` Benutzer: ${username} (${email})`);
      console.log(' Rolle: ADMIN');
      console.log(' Status: ACTIVE');
      console.log('================================================================\n');
    }
  } catch (err: any) {
    console.error('[Bootstrap] Fehler während des Vorgangs:', err.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

runBootstrap();
