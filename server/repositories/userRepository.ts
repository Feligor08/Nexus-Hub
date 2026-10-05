import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { executeQuery, getLastDatabaseStatus, withTransaction } from '../config/database';
import { User, UserSession } from '../models/types';
import { db } from '../db';

export class UserRepository {
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
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT * FROM users WHERE username = ? LIMIT 1`,
          [username]
        );
        if (rows.length > 0) {
          const r = rows[0];
          const rolesRows = await executeQuery<any>(
            `SELECT role_id FROM user_roles WHERE user_id = ?`,
            [r.id]
          );
          const badgesRows = await executeQuery<any>(
            `SELECT badge FROM user_badges WHERE user_id = ?`,
            [r.id]
          );

          const roleList = rolesRows.map((x) => x.role_id);
          const primaryRole = roleList[0] || 'USER';

          return {
            id: r.id,
            username: r.username,
            email: r.email,
            displayName: r.display_name,
            role: primaryRole,
            roles: roleList.length > 0 ? roleList : [primaryRole],
            avatar: r.avatar_url || '/src/assets/images/avatar_ita_developer_1790662143237.jpg',
            bio: r.bio || '',
            skills: ['C#', 'WPF', 'Docker', 'MariaDB', '8051 Assembler'],
            technologies: ['Ubuntu 24.04', 'CasaOS', 'Tailscale', 'Fabric API', 'Bambu P1S'],
            badges: badgesRows.map((b) => b.badge),
            githubUrl: r.github_url,
            websiteUrl: r.website_url || r.website,
            website: r.website || r.website_url,
            location: r.location || '',
            createdAt: r.created_at,
            status: r.status,
            lastLoginAt: r.last_login_at,
          };
        }
      } catch (err) {
        console.warn('MariaDB findByUsername failed:', err);
      }
    }
    const memUser = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (memUser) {
      return {
        ...memUser,
        roles: memUser.roles || [memUser.role],
        websiteUrl: memUser.websiteUrl || memUser.website,
        website: memUser.website || memUser.websiteUrl,
        location: memUser.location || '',
      };
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT * FROM users WHERE id = ? LIMIT 1`,
          [id]
        );
        if (rows.length > 0) {
          return this.findByUsername(rows[0].username);
        }
      } catch (err) {
        console.warn('MariaDB findById failed:', err);
      }
    }
    const memUser = db.users.find((u) => u.id === id);
    if (memUser) {
      return {
        ...memUser,
        roles: memUser.roles || [memUser.role],
      };
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT * FROM users WHERE email = ? LIMIT 1`,
          [email]
        );
        if (rows.length > 0) {
          return this.findByUsername(rows[0].username);
        }
      } catch (err) {
        console.warn('MariaDB findByEmail failed:', err);
      }
    }
    const memUser = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (memUser) {
      return {
        ...memUser,
        roles: memUser.roles || [memUser.role],
      };
    }
    return null;
  }

  async findWithCredentials(identifier: string): Promise<(User & { passwordHash?: string }) | null> {
    const clean = (identifier || '').trim().toLowerCase();
    if (!clean) return null;

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1`,
          [clean, clean]
        );
        if (rows.length > 0) {
          const r = rows[0];
          const user = await this.findByUsername(r.username);
          if (user) {
            return {
              ...user,
              passwordHash: r.password_hash,
            };
          }
        }
      } catch (err) {
        console.warn('MariaDB findWithCredentials failed:', err);
      }
    }

    const mem = db.users.find(
      (u) => u.email.toLowerCase() === clean || u.username.toLowerCase() === clean
    );
    if (mem) {
      return {
        ...mem,
        roles: mem.roles || [mem.role],
        passwordHash: mem.passwordHash,
      };
    }
    return null;
  }

  async createUser(data: {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    displayName: string;
    avatarUrl?: string;
    bio?: string;
    initialRole?: 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';
    initialRoles?: ('USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN')[];
    initialBadges?: string[];
  }): Promise<User> {
    const dbStatus = getLastDatabaseStatus();
    const nowIso = new Date().toISOString();

    const initialRole = data.initialRole || 'USER';
    const initialRoles = data.initialRoles || [initialRole];
    const initialBadges = data.initialBadges || ['Community Member'];

    const newUser: User = {
      id: data.id,
      username: data.username,
      email: data.email,
      displayName: data.displayName,
      role: initialRole,
      roles: initialRoles,
      passwordHash: data.passwordHash,
      avatar: data.avatarUrl || '/src/assets/images/avatar_ita_developer_1790662143237.jpg',
      bio: data.bio || '',
      skills: [],
      technologies: [],
      badges: initialBadges,
      createdAt: nowIso,
      status: 'ACTIVE',
    };

    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO users (id, username, email, password_hash, display_name, avatar_url, bio, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
          [
            data.id,
            data.username,
            data.email,
            data.passwordHash,
            data.displayName,
            newUser.avatar,
            newUser.bio,
          ]
        );

        for (const r of initialRoles) {
          await executeQuery(
            `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
            [data.id, r]
          );
        }

        for (const b of initialBadges) {
          await executeQuery(
            `INSERT INTO user_badges (user_id, badge) VALUES (?, ?)`,
            [data.id, b]
          );
        }
      } catch (err) {
        console.warn('MariaDB createUser query error:', err);
      }
    }

    // Also persist in server memory
    const existingIdx = db.users.findIndex((u) => u.id === data.id);
    if (existingIdx >= 0) {
      db.users[existingIdx] = newUser;
    } else {
      db.users.push(newUser);
    }

    return newUser;
  }

  /**
   * Atomic Registration Transaction:
   * BEGIN -> Insert User -> Insert Role ('USER') -> Insert Badge -> Insert Session -> COMMIT
   * Rolls back on any error (e.g. duplicate username/email)
   */
  async registerUserWithSession(
    userData: {
      id: string;
      username: string;
      email: string;
      passwordHash: string;
      displayName: string;
      avatarUrl?: string;
      bio?: string;
    },
    sessionData: {
      id: string;
      token: string;
      ipAddress?: string;
      userAgent?: string;
      daysValid?: number;
    }
  ): Promise<{ user: User; session: UserSession }> {
    const dbStatus = getLastDatabaseStatus();
    const nowIso = new Date().toISOString();
    const daysValid = sessionData.daysValid || 30;
    const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();
    const tokenHash = this.hashToken(sessionData.token);

    const newUser: User = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      displayName: userData.displayName,
      role: 'USER',
      roles: ['USER'],
      passwordHash: userData.passwordHash,
      avatar: userData.avatarUrl || '/src/assets/images/avatar_ita_developer_1790662143237.jpg',
      bio: userData.bio || '',
      skills: [],
      technologies: [],
      badges: ['Community Member'],
      createdAt: nowIso,
      status: 'ACTIVE',
    };

    const newSession: UserSession = {
      id: sessionData.id,
      userId: userData.id,
      tokenHash,
      token: sessionData.token,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      expiresAt,
      createdAt: nowIso,
    };

    if (dbStatus.connected) {
      await withTransaction(async (conn) => {
        // 1. Insert User
        await conn.execute(
          `INSERT INTO users (id, username, email, password_hash, display_name, avatar_url, bio, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
          [
            newUser.id,
            newUser.username,
            newUser.email,
            userData.passwordHash,
            newUser.displayName,
            newUser.avatar,
            newUser.bio,
          ]
        );

        // 2. Insert Default 'USER' Role
        await conn.execute(
          `INSERT INTO user_roles (user_id, role_id) VALUES (?, 'USER')`,
          [newUser.id]
        );

        // 3. Insert Default Badge
        await conn.execute(
          `INSERT INTO user_badges (user_id, badge) VALUES (?, 'Community Member')`,
          [newUser.id]
        );

        // 4. Insert Initial Session
        await conn.execute(
          `INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            newSession.id,
            newUser.id,
            tokenHash,
            newSession.ipAddress || '127.0.0.1',
            (newSession.userAgent || '').substring(0, 255),
            new Date(expiresAt),
          ]
        );
      });
    }

    // Persist in memory store
    const existingIdx = db.users.findIndex((u) => u.id === newUser.id);
    if (existingIdx >= 0) {
      db.users[existingIdx] = newUser;
    } else {
      db.users.push(newUser);
    }
    db.sessions.push(newSession);

    return { user: newUser, session: newSession };
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<User | null> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const fields: string[] = [];
        const values: any[] = [];

        if (data.username !== undefined) {
          fields.push('username = ?');
          values.push(data.username);
        }
        if (data.displayName !== undefined) {
          fields.push('display_name = ?');
          values.push(data.displayName);
        }
        if (data.bio !== undefined) {
          fields.push('bio = ?');
          values.push(data.bio);
        }
        if (data.avatar !== undefined) {
          fields.push('avatar_url = ?');
          values.push(data.avatar);
        }
        if (data.githubUrl !== undefined) {
          fields.push('github_url = ?');
          values.push(data.githubUrl);
        }
        if (data.websiteUrl !== undefined || data.website !== undefined) {
          const web = data.website || data.websiteUrl;
          fields.push('website_url = ?');
          values.push(web);
        }
        if (data.location !== undefined) {
          fields.push('location = ?');
          values.push(data.location);
        }

        if (fields.length > 0) {
          values.push(userId);
          await executeQuery(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
        }
      } catch (err) {
        console.warn('MariaDB updateProfile query error:', err);
        throw err;
      }
    }

    const u = db.users.find((user) => user.id === userId);
    if (u) {
      if (data.username !== undefined) u.username = data.username;
      if (data.displayName !== undefined) u.displayName = data.displayName;
      if (data.bio !== undefined) u.bio = data.bio;
      if (data.avatar !== undefined) u.avatar = data.avatar;
      if (data.githubUrl !== undefined) u.githubUrl = data.githubUrl;
      if (data.websiteUrl !== undefined || data.website !== undefined) {
        u.websiteUrl = data.website || data.websiteUrl;
        u.website = u.websiteUrl;
      }
      if (data.location !== undefined) u.location = data.location;
      if (data.skills !== undefined) u.skills = data.skills;
      if (data.technologies !== undefined) u.technologies = data.technologies;
      return u;
    }

    return this.findById(userId);
  }

  async updatePassword(userId: string, newHash: string): Promise<boolean> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`, [newHash, userId]);
      } catch (err) {
        console.warn('MariaDB updatePassword error:', err);
      }
    }
    const u = db.users.find((user) => user.id === userId);
    if (u) {
      u.passwordHash = newHash;
    }
    return true;
  }

  async updateLastLogin(userId: string): Promise<void> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [userId]);
      } catch (err) {
        console.warn('MariaDB updateLastLogin error:', err);
      }
    }
    const u = db.users.find((user) => user.id === userId);
    if (u) {
      u.lastLoginAt = new Date().toISOString();
    }
  }

  async getAllUsers(): Promise<User[]> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(`SELECT username FROM users ORDER BY created_at ASC`);
        const users: User[] = [];
        for (const r of rows) {
          const u = await this.findByUsername(r.username);
          if (u) users.push(u);
        }
        if (users.length > 0) return users;
      } catch (err) {
        console.warn('MariaDB getAllUsers failed:', err);
      }
    }
    return db.users;
  }

  async updateRole(userId: string, newRole: string): Promise<User | null> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
        await executeQuery(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, newRole]);
      } catch (err) {
        console.warn('MariaDB updateRole failed:', err);
      }
    }

    let u = db.users.find((user) => user.id === userId);
    if (!u) {
      const found = await this.findById(userId);
      if (found) {
        u = found;
        db.users.push(u);
      }
    }
    if (u) {
      u.role = newRole as any;
      if (!u.roles) u.roles = [newRole];
      else if (!u.roles.includes(newRole)) u.roles = [newRole, ...u.roles];
      return u;
    }
    return null;
  }

  async toggleStatus(userId: string): Promise<User | null> {
    const u = db.users.find((user) => user.id === userId);
    if (!u) return null;
    const newStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    u.status = newStatus;

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`UPDATE users SET status = ? WHERE id = ?`, [newStatus, userId]);
      } catch (err) {
        console.warn('MariaDB toggleStatus failed:', err);
      }
    }
    return u;
  }

  // -------------------------------------------------------------
  // SESSION STORAGE (In-memory + MariaDB user_sessions)
  // -------------------------------------------------------------
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createSession(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
    daysValid: number = 30
  ): Promise<UserSession> {
    const id = `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    const session: UserSession = {
      id,
      userId,
      tokenHash,
      token,
      ipAddress,
      userAgent,
      expiresAt,
      createdAt,
    };

    // Store in memory
    db.sessions.push(session);

    // Store in MariaDB if available
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, userId, tokenHash, ipAddress || '127.0.0.1', (userAgent || '').substring(0, 255), new Date(expiresAt)]
        );
      } catch (err) {
        console.warn('MariaDB createSession error:', err);
      }
    }

    return session;
  }

  async findSession(token: string): Promise<{ session: UserSession; user: User } | null> {
    const tokenHash = this.hashToken(token);
    const now = new Date().getTime();

    // Check memory first
    const memSession = db.sessions.find(
      (s) => (s.token === token || s.tokenHash === tokenHash) && new Date(s.expiresAt).getTime() > now
    );

    if (memSession) {
      const user = await this.findById(memSession.userId);
      if (user && user.status === 'ACTIVE') {
        return { session: memSession, user };
      }
    }

    // Check MariaDB
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT * FROM user_sessions WHERE token_hash = ? AND expires_at > NOW() LIMIT 1`,
          [tokenHash]
        );
        if (rows.length > 0) {
          const r = rows[0];
          const user = await this.findById(r.user_id);
          if (user && user.status === 'ACTIVE') {
            const s: UserSession = {
              id: r.id,
              userId: r.user_id,
              tokenHash: r.token_hash,
              token,
              ipAddress: r.ip_address,
              userAgent: r.user_agent,
              expiresAt: new Date(r.expires_at).toISOString(),
              createdAt: new Date(r.created_at).toISOString(),
            };
            // Cache in memory
            db.sessions.push(s);
            return { session: s, user };
          }
        }
      } catch (err) {
        console.warn('MariaDB findSession error:', err);
      }
    }

    return null;
  }

  async deleteSession(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const idx = db.sessions.findIndex((s) => s.token === token || s.tokenHash === tokenHash);
    if (idx >= 0) {
      db.sessions.splice(idx, 1);
    }

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`DELETE FROM user_sessions WHERE token_hash = ?`, [tokenHash]);
      } catch (err) {
        console.warn('MariaDB deleteSession error:', err);
      }
    }
  }

  async deleteUserSessions(userId: string): Promise<void> {
    db.sessions = db.sessions.filter((s) => s.userId !== userId);
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
      } catch (err) {
        console.warn('MariaDB deleteUserSessions error:', err);
      }
    }
  }

  async getUserSessions(userId: string, currentToken?: string): Promise<Array<{
    id: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: string;
    createdAt: string;
    isCurrent: boolean;
  }>> {
    const currentTokenHash = currentToken ? this.hashToken(currentToken) : null;
    const dbStatus = getLastDatabaseStatus();

    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT id, token_hash, ip_address, user_agent, expires_at, created_at 
           FROM user_sessions 
           WHERE user_id = ? AND expires_at > NOW() 
           ORDER BY created_at DESC`,
          [userId]
        );
        if (rows.length > 0) {
          return rows.map((r) => ({
            id: r.id,
            ipAddress: r.ip_address,
            userAgent: r.user_agent,
            expiresAt: new Date(r.expires_at).toISOString(),
            createdAt: new Date(r.created_at).toISOString(),
            isCurrent: currentTokenHash ? r.token_hash === currentTokenHash : false,
          }));
        }
      } catch (err) {
        console.warn('MariaDB getUserSessions error:', err);
      }
    }

    const now = Date.now();
    return db.sessions
      .filter((s) => s.userId === userId && new Date(s.expiresAt).getTime() > now)
      .map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
        isCurrent: currentToken ? s.token === currentToken || s.tokenHash === currentTokenHash : false,
      }));
  }

  async deleteOtherSessions(userId: string, currentToken: string): Promise<void> {
    const currentHash = this.hashToken(currentToken);
    db.sessions = db.sessions.filter(
      (s) => s.userId !== userId || s.token === currentToken || s.tokenHash === currentHash
    );

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `DELETE FROM user_sessions WHERE user_id = ? AND token_hash != ?`,
          [userId, currentHash]
        );
      } catch (err) {
        console.warn('MariaDB deleteOtherSessions error:', err);
      }
    }
  }
}

export const userRepository = new UserRepository();
