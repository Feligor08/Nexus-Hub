import { randomUUID } from 'crypto';
import { executeQuery, getLastDatabaseStatus, withTransaction } from '../config/database';
import { userRepository } from '../repositories/userRepository';

export interface BootstrapCandidate {
  id: string;
  username: string;
  email: string;
  displayName: string;
  status: string;
}

export interface BootstrapResult extends BootstrapCandidate {
  created: boolean;
}

export class AdminBootstrapService {
  private requireDatabase(): void {
    if (!getLastDatabaseStatus().connected) throw new Error('MariaDB ist nicht erreichbar. Admin-Bootstrap abgebrochen.');
  }

  async findCandidate(email: string, username: string): Promise<{ adminExists: boolean; candidate: BootstrapCandidate | null }> {
    this.requireDatabase();
    const [admins, users] = await Promise.all([
      executeQuery<any>(`SELECT user_id FROM user_roles WHERE role_id = 'ADMIN' LIMIT 1`),
      executeQuery<any>(
        `SELECT id, username, email, display_name AS displayName, status FROM users
         WHERE email = ? OR username = ? LIMIT 2`,
        [email.trim().toLowerCase(), username.trim()]
      ),
    ]);
    if (users.length > 1) throw new Error('E-Mail und Username gehören zu unterschiedlichen Accounts.');
    return { adminExists: admins.length > 0, candidate: users[0] || null };
  }

  async bootstrap(input: {
    email: string;
    username: string;
    displayName: string;
    password?: string;
    confirmExistingAccount: boolean;
  }): Promise<BootstrapResult> {
    this.requireDatabase();
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();
    const displayName = input.displayName.trim();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) throw new Error('Username muss 3-30 sichere Zeichen enthalten.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 191) throw new Error('E-Mail-Adresse ist ungültig.');
    if (!displayName || displayName.length > 100) throw new Error('Display Name ist ungültig.');
    if (input.password && (input.password.length < 12 || Buffer.byteLength(input.password, 'utf8') > 72)) {
      throw new Error('Passwort muss mindestens 12 Zeichen lang sein und höchstens 72 UTF-8-Bytes umfassen.');
    }
    const passwordHash = input.password ? await userRepository.hashPassword(input.password) : null;

    return withTransaction(async (connection) => {
      const [roleRows] = await connection.execute<any[]>(`SELECT id FROM roles WHERE id = 'ADMIN' FOR UPDATE`);
      if (!roleRows.length) throw new Error('ADMIN-Systemrolle fehlt. Systemreferenzmigrationen wurden nicht ausgeführt.');
      const [adminRows] = await connection.execute<any[]>(
        `SELECT user_id FROM user_roles WHERE role_id = 'ADMIN' LIMIT 1 FOR UPDATE`
      );
      if (adminRows.length) throw new Error('Ein Administrator existiert bereits; Bootstrap ist nur einmal möglich.');

      const [users] = await connection.execute<any[]>(
        `SELECT id, username, email, display_name AS displayName, status FROM users
         WHERE email = ? OR username = ? LIMIT 2 FOR UPDATE`,
        [email, username]
      );
      if (users.length > 1) throw new Error('E-Mail und Username gehören zu unterschiedlichen Accounts.');

      let user: BootstrapCandidate;
      let created = false;
      if (users.length) {
        user = users[0] as BootstrapCandidate;
        if (!input.confirmExistingAccount) throw new Error('Bestehender Account benötigt eine explizite Bestätigung.');
        if (user.status !== 'ACTIVE') throw new Error('Ein gesperrter Account kann nicht Administrator werden.');
        await connection.execute(`INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'ADMIN')`, [user.id]);
      } else {
        if (!passwordHash) throw new Error('Für einen neuen Account ist ein Passwort erforderlich.');
        const id = `usr-${randomUUID()}`;
        await connection.execute(
          `INSERT INTO users (id, username, email, password_hash, display_name, avatar_url, bio, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, '', '', 'ACTIVE', NOW(), NOW())`,
          [id, username, email, passwordHash, displayName]
        );
        await connection.execute(`INSERT INTO user_roles (user_id, role_id) VALUES (?, 'ADMIN')`, [id]);
        await connection.execute(`INSERT INTO user_badges (user_id, badge) VALUES (?, 'Administrator')`, [id]);
        user = { id, username, email, displayName, status: 'ACTIVE' };
        created = true;
      }

      await connection.execute(
        `INSERT INTO audit_logs (id, user_id, username, action, details, ip, created_at)
         VALUES (?, ?, ?, 'ADMIN_BOOTSTRAP', ?, '127.0.0.1', NOW())`,
        [`log-${randomUUID()}`, user.id, user.username, created ? 'Initial admin account created via local CLI.' : 'Admin role granted to explicitly confirmed account via local CLI.']
      );
      return { ...user, created };
    });
  }
}

export const adminBootstrapService = new AdminBootstrapService();