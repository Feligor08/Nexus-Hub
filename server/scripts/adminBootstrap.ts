import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { executeQuery, getLastDatabaseStatus, testDatabaseConnection } from '../config/database';
import { userRepository } from '../repositories/userRepository';
import { auditRepository } from '../repositories/auditRepository';

dotenv.config();

export interface BootstrapOptions {
  username?: string;
  email?: string;
  displayName?: string;
  password?: string;
  forceUpdate?: boolean;
  skipDatabaseCheck?: boolean;
}

export interface BootstrapResult {
  success: boolean;
  status: 'CREATED' | 'UPDATED' | 'ELEVATED' | 'CONFLICT' | 'ERROR';
  userId?: string;
  username: string;
  email: string;
  role: string;
  message: string;
}

/**
 * Normalizes email address (lowercase and trimmed)
 */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Validates admin username format
 */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,30}$/.test((username || '').trim());
}

/**
 * Validates admin password strength (minimum 12 characters)
 */
export function isValidAdminPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 12;
}

/**
 * Core idempotent admin bootstrap logic
 */
export async function bootstrapAdmin(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const targetUsername = (options.username || process.env.ADMIN_BOOTSTRAP_USERNAME || 'FelixFocus08').trim();
  const targetEmail = normalizeEmail(options.email || process.env.ADMIN_BOOTSTRAP_EMAIL || 'fschlueter08@gmail.com');
  const targetDisplayName = (options.displayName || process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || 'FelixFocus08').trim();
  const password = options.password || process.env.ADMIN_BOOTSTRAP_PASSWORD || '';

  // 1. Input Validation
  if (!isValidUsername(targetUsername)) {
    return {
      success: false,
      status: 'ERROR',
      username: targetUsername,
      email: targetEmail,
      role: 'ADMIN',
      message: 'Ungültiger Benutzername. Erlaubt sind 3-30 alphanumerische Zeichen und Unterstriche.',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!targetEmail || !emailRegex.test(targetEmail)) {
    return {
      success: false,
      status: 'ERROR',
      username: targetUsername,
      email: targetEmail,
      role: 'ADMIN',
      message: 'Ungültige E-Mail-Adresse für den Administrator.',
    };
  }

  if (!password) {
    return {
      success: false,
      status: 'ERROR',
      username: targetUsername,
      email: targetEmail,
      role: 'ADMIN',
      message: 'Administrator-Passwort fehlt. Bitte ADMIN_BOOTSTRAP_PASSWORD als Umgebungsvariable übergeben oder interaktiv eingeben.',
    };
  }

  if (!isValidAdminPassword(password)) {
    return {
      success: false,
      status: 'ERROR',
      username: targetUsername,
      email: targetEmail,
      role: 'ADMIN',
      message: 'Das Administrator-Passwort muss mindestens 12 Zeichen lang sein (Sicherheitsrichtlinie).',
    };
  }

  // 2. Database Connection Check
  if (!options.skipDatabaseCheck) {
    const dbStatus = await testDatabaseConnection();
    if (!dbStatus.connected) {
      return {
        success: false,
        status: 'ERROR',
        username: targetUsername,
        email: targetEmail,
        role: 'ADMIN',
        message: `MariaDB ist nicht erreichbar (${dbStatus.diagnosticCode}). Der Admin-Bootstrap erfordert eine aktive MariaDB-Verbindung; keine In-Memory-Fallbacks im Produktivmodus.`,
      };
    }
  }

  // 3. Conflict & Integrity Checks
  const existingByEmail = await userRepository.findByEmail(targetEmail);
  const existingByUsername = await userRepository.findByUsername(targetUsername);

  // If two different accounts exist for email and username, abort to prevent account cross-contamination
  if (existingByEmail && existingByUsername && existingByEmail.id !== existingByUsername.id) {
    return {
      success: false,
      status: 'CONFLICT',
      username: targetUsername,
      email: targetEmail,
      role: 'ADMIN',
      message: `Konflikt: E-Mail "${targetEmail}" (ID: ${existingByEmail.id}) und Benutzername "${targetUsername}" (ID: ${existingByUsername.id}) gehören zu unterschiedlichen Konten. Abbruch zum Schutz vor Kontenübernahme.`,
    };
  }

  // If user with matching email exists, but has a different username
  if (existingByEmail && existingByEmail.username.toLowerCase() !== targetUsername.toLowerCase()) {
    return {
      success: false,
      status: 'CONFLICT',
      username: targetUsername,
      email: targetEmail,
      role: 'ADMIN',
      message: `Konflikt: Konto mit E-Mail "${targetEmail}" existiert bereits unter abweichendem Benutzernamen ("${existingByEmail.username}"). Abbruch.`,
    };
  }

  // If user with matching username exists, but has a different email
  if (existingByUsername && normalizeEmail(existingByUsername.email) !== targetEmail) {
    return {
      success: false,
      status: 'CONFLICT',
      username: targetUsername,
      email: targetEmail,
      role: 'ADMIN',
      message: `Konflikt: Konto mit Benutzername "${targetUsername}" existiert bereits unter abweichender E-Mail ("${existingByUsername.email}"). Abbruch.`,
    };
  }

  // 4. Update Existing Account (Idempotent Elevation / Password Update)
  const existingUser = existingByEmail || existingByUsername;
  const passwordHash = await userRepository.hashPassword(password);

  if (existingUser) {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      await executeQuery(
        `UPDATE users SET password_hash = ?, display_name = ?, status = 'ACTIVE', updated_at = NOW() WHERE id = ?`,
        [passwordHash, targetDisplayName || existingUser.displayName, existingUser.id]
      );
    }

    await userRepository.updateRole(existingUser.id, 'ADMIN');
    // Audit log without leaking passwords or secrets
    await auditRepository.log(
      'ADMIN_BOOTSTRAP',
      existingUser.id,
      existingUser.username,
      `Administrator-Konto via CLI-Bootstrap bestätigt und aktualisiert (Rolle: ADMIN, Status: ACTIVE)`,
      '127.0.0.1'
    );

    return {
      success: true,
      status: 'UPDATED',
      userId: existingUser.id,
      username: targetUsername,
      email: targetEmail,
      role: 'ADMIN',
      message: `Bestehendes Konto "${targetUsername}" (${targetEmail}) erfolgreich als Administrator bestätigt und aktualisiert.`,
    };
  }

  // 5. Create New Administrator Account
  const newId = `usr-admin-${Date.now()}`;
  const created = await userRepository.createUser({
    id: newId,
    username: targetUsername,
    email: targetEmail,
    displayName: targetDisplayName,
    passwordHash,
    bio: 'Platform Administrator · Nexus Code Play Core Engine',
    initialRole: 'ADMIN',
    initialRoles: ['ADMIN'],
    initialBadges: ['Platform Administrator', 'Security Lead'],
  });

  await userRepository.updateRole(newId, 'ADMIN');

  await auditRepository.log(
    'ADMIN_BOOTSTRAP',
    newId,
    targetUsername,
    `Neues Administrator-Konto via CLI-Bootstrap initialisiert (Rolle: ADMIN, Status: ACTIVE)`,
    '127.0.0.1'
  );

  return {
    success: true,
    status: 'CREATED',
    userId: created.id,
    username: targetUsername,
    email: targetEmail,
    role: 'ADMIN',
    message: `Administrator-Konto "${targetUsername}" (${targetEmail}) erfolgreich in MariaDB initialisiert.`,
  };
}

/**
 * Interactive or automated CLI runner
 */
async function runCli() {
  console.log('================================================================');
  console.log(' NEXUS CODE PLAY — PRODUCTION ADMIN BOOTSTRAP (SPRINT 9)');
  console.log('================================================================\n');

  // Check if non-interactive environment variable is set
  let password = process.env.ADMIN_BOOTSTRAP_PASSWORD || '';
  let email = process.env.ADMIN_BOOTSTRAP_EMAIL || 'fschlueter08@gmail.com';
  let username = process.env.ADMIN_BOOTSTRAP_USERNAME || 'FelixFocus08';
  let displayName = process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || 'FelixFocus08';

  if (!password && input.isTTY) {
    const rl = readline.createInterface({ input, output });
    try {
      console.log('Interaktive Konfiguration für den ersten Administrator:\n');
      const inputEmail = (await rl.question(`1. Admin E-Mail [${email}]: `)).trim();
      if (inputEmail) email = inputEmail;

      const inputUser = (await rl.question(`2. Admin Benutzername [${username}]: `)).trim();
      if (inputUser) username = inputUser;

      const inputDisplay = (await rl.question(`3. Anzeigename [${displayName}]: `)).trim();
      if (inputDisplay) displayName = inputDisplay;

      password = (await rl.question('4. Sicheres Admin-Passwort (mindestens 12 Zeichen): ')).trim();
    } finally {
      rl.close();
    }
  }

  const result = await bootstrapAdmin({
    username,
    email,
    displayName,
    password,
  });

  console.log('\n----------------------------------------------------------------');
  if (result.success) {
    console.log(`[BOOTSTRAP ERFOLG] ${result.message}`);
    console.log(`Benutzername: ${result.username}`);
    console.log(`E-Mail:       ${result.email}`);
    console.log(`Rolle:        ${result.role}`);
    console.log('----------------------------------------------------------------');
    console.log('SICHERHEITSHINWEIS: Bitte melde dich nach dem Start an und ändere');
    console.log('das Passwort bei Bedarf im Profilbereich.');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error(`[BOOTSTRAP FEHLER] ${result.message}`);
    console.log('================================================================\n');
    process.exit(1);
  }
}

// Auto-run if executed directly as a script
const isDirectRun =
  process.argv[1] &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
    process.argv[1].endsWith('adminBootstrap.ts') ||
    process.argv[1].endsWith('adminBootstrap.js'));

if (isDirectRun) {
  runCli().catch((err) => {
    console.error('[Fatal Error]:', err.message);
    process.exit(1);
  });
}
