import crypto from 'crypto';
import { userRepository } from '../repositories/userRepository';
import { User, UserSession } from '../models/types';

export interface RegisterDTO {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginDTO {
  email?: string;
  username?: string;
  emailOrUsername?: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  authenticated: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export class AuthService {
  /**
   * Sanitizes a user object to never leak passwords or hashes
   */
  sanitizeUser(user: User): User {
    const { passwordHash, ...safeUser } = user;
    return {
      ...safeUser,
      roles: safeUser.roles || [safeUser.role],
    };
  }

  /**
   * Generates a cryptographically strong session token (32 bytes = 64 hex chars)
   */
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Register a new user atomically within a database transaction
   */
  async register(dto: RegisterDTO, clientIp?: string, userAgent?: string): Promise<AuthResult> {
    const username = (dto.username || '').trim().toLowerCase();
    const email = (dto.email || '').trim().toLowerCase();
    const password = dto.password || '';
    const displayName = (dto.displayName || '').trim() || username;

    // 1. Validation
    if (!username || username.length < 3 || username.length > 30) {
      return {
        success: false,
        authenticated: false,
        error: 'Der Benutzername muss zwischen 3 und 30 Zeichen lang sein.',
      };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return {
        success: false,
        authenticated: false,
        error: 'Der Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten.',
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return {
        success: false,
        authenticated: false,
        error: 'Die E-Mail-Adresse ist ungültig.',
      };
    }

    if (!password || password.length < 12) {
      return {
        success: false,
        authenticated: false,
        error: 'Das Passwort muss mindestens 12 Zeichen enthalten.',
      };
    }

    // 2. Duplicate Checks
    const existingUsername = await userRepository.findByUsername(username);
    if (existingUsername) {
      return {
        success: false,
        authenticated: false,
        error: 'Dieser Benutzername ist bereits vergeben.',
      };
    }

    const existingEmail = await userRepository.findByEmail(email);
    if (existingEmail) {
      return {
        success: false,
        authenticated: false,
        error: 'Ein Konto mit dieser E-Mail-Adresse existiert bereits.',
      };
    }

    // 3. Password Hashing (bcrypt with 12 salt rounds)
    const passwordHash = await userRepository.hashPassword(password);
    const userId = `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const token = this.generateSessionToken();
    const sessionId = `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    try {
      // 4. Atomic Registration Transaction (User + USER role + Session)
      const { user } = await userRepository.registerUserWithSession(
        {
          id: userId,
          username,
          email,
          passwordHash,
          displayName,
        },
        {
          id: sessionId,
          token,
          ipAddress: clientIp,
          userAgent,
          daysValid: 30,
        }
      );

      return {
        success: true,
        authenticated: true,
        user: this.sanitizeUser(user),
        token,
      };
    } catch (err: any) {
      console.error('Registration transaction failed:', err);
      return {
        success: false,
        authenticated: false,
        error: 'Registrierung fehlgeschlagen. Dieser Benutzername oder diese E-Mail existiert möglicherweise bereits.',
      };
    }
  }

  /**
   * Log in an existing user
   */
  async login(dto: LoginDTO, clientIp?: string, userAgent?: string): Promise<AuthResult> {
    const identifier = (dto.emailOrUsername || dto.email || dto.username || '').trim();
    const password = dto.password || '';

    if (!identifier || !password) {
      return {
        success: false,
        authenticated: false,
        error: 'Bitte E-Mail/Benutzername und Passwort eingeben.',
      };
    }

    // Generic error message for security (Section 10 - prevents user enumeration)
    const genericAuthError = 'E-Mail/Benutzername oder Passwort ist falsch.';

    const userWithCreds = await userRepository.findWithCredentials(identifier);
    if (!userWithCreds) {
      return {
        success: false,
        authenticated: false,
        error: genericAuthError,
      };
    }

    if (userWithCreds.status === 'SUSPENDED') {
      return {
        success: false,
        authenticated: false,
        error: 'Dieses Konto wurde vorübergehend gesperrt. Bitte wende dich an den Support.',
      };
    }

    // Verify Password Hash with bcrypt
    const isPasswordValid = await userRepository.verifyPassword(
      password,
      userWithCreds.passwordHash || ''
    );

    if (!isPasswordValid) {
      return {
        success: false,
        authenticated: false,
        error: genericAuthError,
      };
    }

    // Update last login
    await userRepository.updateLastLogin(userWithCreds.id);

    // Create new secure session
    const token = this.generateSessionToken();
    await userRepository.createSession(userWithCreds.id, token, clientIp, userAgent);

    return {
      success: true,
      authenticated: true,
      user: this.sanitizeUser(userWithCreds),
      token,
    };
  }

  /**
   * Validate a session token
   */
  async validateSession(token: string): Promise<User | null> {
    if (!token) return null;
    const sessionData = await userRepository.findSession(token);
    if (!sessionData) return null;
    return this.sanitizeUser(sessionData.user);
  }

  /**
   * Log out and terminate session serverseitig
   */
  async logout(token: string): Promise<boolean> {
    if (!token) return true;
    await userRepository.deleteSession(token);
    return true;
  }

  /**
   * Change user password with security verification and session re-issuance
   */
  async changePassword(
    userId: string,
    currentPass: string,
    newPass: string,
    currentToken?: string
  ): Promise<{ success: boolean; error?: string; newToken?: string }> {
    if (!currentPass || !newPass) {
      return { success: false, error: 'Bitte aktuelles und neues Passwort eingeben.' };
    }

    if (newPass.length < 12) {
      return { success: false, error: 'Das neue Passwort muss mindestens 12 Zeichen lang sein.' };
    }

    const userWithCreds = await userRepository.findWithCredentials(userId);
    if (!userWithCreds || !userWithCreds.passwordHash) {
      return { success: false, error: 'Benutzerkonto nicht gefunden.' };
    }

    const isValid = await userRepository.verifyPassword(currentPass, userWithCreds.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Das aktuelle Passwort ist nicht korrekt.' };
    }

    const newHash = await userRepository.hashPassword(newPass);
    await userRepository.updatePassword(userId, newHash);

    // Revoke previous sessions for security (Session Revocation)
    await userRepository.deleteUserSessions(userId);

    // Generate a fresh session for the current client
    const newToken = this.generateSessionToken();
    await userRepository.createSession(userId, newToken);

    return { success: true, newToken };
  }
}

export const authService = new AuthService();
