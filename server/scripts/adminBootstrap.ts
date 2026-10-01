import { testDatabaseConnection } from '../config/database';
import { adminBootstrapService } from '../services/adminBootstrapService';

function ask(promptText: string, hideInput = false): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Admin-Bootstrap benötigt ein interaktives Terminal.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(promptText);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();

    const finish = (error?: Error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('Abgebrochen.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0008' || character === '\u007f') {
          value = value.slice(0, -1);
          if (!hideInput) process.stdout.write('\b \b');
          continue;
        }
        if (character >= ' ') {
          value += character;
          if (!hideInput) process.stdout.write(character);
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

async function run(): Promise<void> {
  const database = await testDatabaseConnection();
  if (!database.connected) throw new Error('MariaDB ist nicht erreichbar. Bootstrap abgebrochen.');
  process.stdout.write('MariaDB-Verbindung bestätigt; es werden keine Migrationen ausgeführt.\n');

  const email = (await ask('E-Mail: ')).trim().toLowerCase();
  const username = (await ask('Username: ')).trim();
  const displayName = (await ask('Display Name: ')).trim();
  const { adminExists, candidate } = await adminBootstrapService.findCandidate(email, username);
  if (adminExists) throw new Error('Ein Administrator existiert bereits. Bootstrap ist gesperrt.');

  let confirmExistingAccount = false;
  let password: string | undefined;
  if (candidate) {
    process.stdout.write(`Bestehender Account: ${candidate.displayName} (@${candidate.username}, ${candidate.email})\n`);
    confirmExistingAccount = (await ask('Diesen Account zum Administrator machen? Tippe JA: ')).trim() === 'JA';
    if (!confirmExistingAccount) throw new Error('Bestehender Account nicht bestätigt; keine Änderung vorgenommen.');
  } else {
    password = await ask('Passwort für neuen Account (Eingabe verborgen): ', true);
    const confirmation = await ask('Passwort bestätigen (Eingabe verborgen): ', true);
    if (password !== confirmation) throw new Error('Passwörter stimmen nicht überein.');
  }

  const user = await adminBootstrapService.bootstrap({ email, username, displayName, password, confirmExistingAccount });
  process.stdout.write(`ADMIN-Bootstrap abgeschlossen für @${user.username}.\n`);
}

run().catch((error: unknown) => {
  if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stderr.write(`${error instanceof Error ? error.message : 'Admin-Bootstrap fehlgeschlagen.'}\n`);
  process.exitCode = 1;
});