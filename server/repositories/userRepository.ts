import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { executeQuery, getLastDatabaseStatus, withTransaction } from '../config/database';
import { User, UserSession } from '../models/types';

function parseStringArray(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('Ungültige Profildaten in der Datenbank.');
  }
  return parsed;
}

export class UserRepository {
  private requireDatabase(): void {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Benutzerdaten sind derzeit nicht verfügbar.');
    }
  }

  private async mapUser(row: Record<string, any>): Promise<User> {
    const [rolesRows, badgesRows] = await Promise.all([
      executeQuery<any>(`SELECT role_id FROM user_roles WHERE user_id = ?`, [row.id]),
      executeQuery<any>(`SELECT badge FROM user_badges WHERE user_id = ?`, [row.id]),
    ]);
    const roles = rolesRows.map((roleRow) => roleRow.role_id as string);
    const primaryRole = roles[0] || 'USER';
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      displayName: row.display_name,
      role: primaryRole as User['role'],
      roles: roles.length ? roles : [primaryRole],
      avatar: row.avatar_url || '',
      bio: row.bio || '',
      skills: parseStringArray(row.skills),
      technologies: parseStringArray(row.technologies),
      badges: badgesRows.map((badgeRow) => badgeRow.badge),
      githubUrl: row.github_url,
      websiteUrl: row.website_url,
      createdAt: row.created_at,
      status: row.status,
      lastLoginAt: row.last_login_at,
    };
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!hash) return false;
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    this.requireDatabase();
    const rows = await executeQuery<any>(`SELECT * FROM users WHERE username = ? LIMIT 1`, [username]);
    return rows.length ? this.mapUser(rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    this.requireDatabase();
    const rows = await executeQuery<any>(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
    return rows.length ? this.mapUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    this.requireDatabase();
    const rows = await executeQuery<any>(`SELECT * FROM users WHERE email = ? LIMIT 1`, [email]);
    return rows.length ? this.mapUser(rows[0]) : null;
  }

  async findWithCredentials(identifier: string): Promise<(User & { passwordHash?: string }) | null> {
    this.requireDatabase();
    const rows = await executeQuery<any>(`SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1`, [identifier, identifier]);
    if (!rows.length) return null;
    return { ...await this.mapUser(rows[0]), passwordHash: rows[0].password_hash || undefined };
  }

  async registerUser(data: {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    displayName: string;
    avatarUrl?: string;
    bio?: string;
  }, token: string, ipAddress?: string, userAgent?: string): Promise<User> {
    this.requireDatabase();
    const nowIso = new Date().toISOString();
    const initialRole = 'USER';
    const initialBadges = ['Community Member'];
    const sessionId = `sess-${randomUUID()}`;
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const newUser: User = {
      id: data.id,
      username: data.username,
      email: data.email,
      displayName: data.displayName,
      role: initialRole,
      roles: [initialRole],
      passwordHash: data.passwordHash,
      avatar: data.avatarUrl || '/src/assets/images/avatar_ita_developer_1790662143237.jpg',
      bio: data.bio || '',
      skills: [],
      technologies: [],
      badges: initialBadges,
      createdAt: nowIso,
      status: 'ACTIVE',
    };

    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO users (id, username, email, password_hash, display_name, avatar_url, bio, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
        [data.id, data.username, data.email, data.passwordHash, data.displayName, newUser.avatar, newUser.bio]
      );
      await connection.execute(`INSERT INTO user_roles (user_id, role_id) VALUES (?, 'USER')`, [data.id]);
      for (const badge of initialBadges) {
        await connection.execute(`INSERT INTO user_badges (user_id, badge) VALUES (?, ?)`, [data.id, badge]);
      }
      await connection.execute(
        `INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, data.id, tokenHash, ipAddress || null, (userAgent || '').slice(0, 255), expiresAt]
      );
    });

    return newUser;
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<User | null> {
    this.requireDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.displayName !== undefined) { fields.push('display_name = ?'); values.push(data.displayName); }
    if (data.bio !== undefined) { fields.push('bio = ?'); values.push(data.bio); }
    if (data.avatar !== undefined) { fields.push('avatar_url = ?'); values.push(data.avatar); }
    if (data.githubUrl !== undefined) { fields.push('github_url = ?'); values.push(data.githubUrl); }
    if (data.websiteUrl !== undefined) { fields.push('website_url = ?'); values.push(data.websiteUrl); }
    if (data.skills !== undefined) { fields.push('skills = ?'); values.push(JSON.stringify(data.skills)); }
    if (data.technologies !== undefined) { fields.push('technologies = ?'); values.push(JSON.stringify(data.technologies)); }
    if (fields.length) {
          values.push(userId);
          await executeQuery(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values as string[]);
    }
    return this.findById(userId);
  }

  async updateLastLogin(userId: string): Promise<void> {
    this.requireDatabase();
    await executeQuery(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [userId]);
  }

  async changePassword(userId: string, passwordHash: string, currentSessionToken: string): Promise<boolean> {
    this.requireDatabase();
    const currentTokenHash = this.hashToken(currentSessionToken);
    return withTransaction(async (connection) => {
      const [result] = await connection.execute(
        `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
        [passwordHash, userId]
      );
      if ((result as { affectedRows: number }).affectedRows === 0) return false;
      await connection.execute(
        `DELETE FROM user_sessions WHERE user_id = ? AND token_hash <> ?`,
        [userId, currentTokenHash]
      );
      return true;
    });
  }

  async getAllUsers(): Promise<User[]> {
    this.requireDatabase();
    const rows = await executeQuery<any>(`SELECT * FROM users ORDER BY created_at ASC`);
    return Promise.all(rows.map((row) => this.mapUser(row)));
  }

  async updateRole(userId: string, newRole: string): Promise<User | null> {
    this.requireDatabase();
    await withTransaction(async (connection) => {
      await connection.execute(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
      await connection.execute(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, newRole]);
    });
    return this.findById(userId);
  }

  async toggleStatus(userId: string): Promise<User | null> {
    this.requireDatabase();
    const rows = await executeQuery<any>(`SELECT status FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (!rows.length) return null;
    const newStatus = rows[0].status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await executeQuery(`UPDATE users SET status = ? WHERE id = ?`, [newStatus, userId]);
    return this.findById(userId);
  }

  // -------------------------------------------------------------
  // SESSION STORAGE (In-memory + MariaDB user_sessions)
  // -------------------------------------------------------------
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createSession(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
    daysValid: number = 30
  ): Promise<UserSession> {
    this.requireDatabase();
    const id = `sess-${randomUUID()}`;
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    const session: UserSession = {
      id,
      userId,
      tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
      createdAt,
    };

    await executeQuery(
      `INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, tokenHash, ipAddress || null, (userAgent || '').substring(0, 255), new Date(expiresAt)]
    );

    return session;
  }

  async findSession(token: string): Promise<{ session: UserSession; user: User } | null> {
    this.requireDatabase();
    const tokenHash = this.hashToken(token);
    const rows = await executeQuery<any>(
      `SELECT * FROM user_sessions WHERE token_hash = ? AND expires_at > NOW() LIMIT 1`,
      [tokenHash]
    );
    if (!rows.length) return null;
    const row = rows[0];
    const user = await this.findById(row.user_id);
    if (!user || user.status !== 'ACTIVE') return null;
    const session: UserSession = {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: new Date(row.expires_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
    };
    return { session, user };
  }

  async deleteSession(token: string): Promise<void> {
    this.requireDatabase();
    const tokenHash = this.hashToken(token);
    await executeQuery(`DELETE FROM user_sessions WHERE token_hash = ?`, [tokenHash]);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    this.requireDatabase();
    await executeQuery(`DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
  }
}

export const userRepository = new UserRepository();
