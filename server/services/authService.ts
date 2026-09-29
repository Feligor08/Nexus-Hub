import crypto from 'crypto';
import { userRepository } from '../repositories/userRepository';
import { User, UserSession } from '../models/types';

export interface RegisterDTO {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface LoginDTO {
  email: string;
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
   * Generates a cryptographically strong session token
   */
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Register a new user
   */
  async register(dto: RegisterDTO, clientIp?: string, userAgent?: string): Promise<AuthResult> {
    const username = (dto.username || '').trim();
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
        error: 'Bitte gib eine gültige E-Mail-Adresse ein.',
      };
    }

    if (!password || password.length < 6) {
      return {
        success: false,
        authenticated: false,
        error: 'Das Passwort muss mindestens 6 Zeichen lang sein.',
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

    // 3. Password Hashing (bcrypt with salt rounds)
    const passwordHash = await userRepository.hashPassword(password);
    const userId = `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    // 4. Create User in MariaDB and Store
    const createdUser = await userRepository.createUser({
      id: userId,
      username,
      email,
      passwordHash,
      displayName,
    });

    // 5. Create Session
    const token = this.generateSessionToken();
    await userRepository.createSession(createdUser.id, token, clientIp, userAgent);

    return {
      success: true,
      authenticated: true,
      user: this.sanitizeUser(createdUser),
      token,
    };
  }

  /**
   * Log in an existing user
   */
  async login(dto: LoginDTO, clientIp?: string, userAgent?: string): Promise<AuthResult> {
    const identifier = (dto.email || '').trim();
    const password = dto.password || '';

    if (!identifier || !password) {
      return {
        success: false,
        authenticated: false,
        error: 'Bitte E-Mail/Benutzername und Passwort eingeben.',
      };
    }

    // Generic error message for security (Section 7)
    const genericAuthError = 'Ungültige Anmeldedaten. Bitte überprüfe deine Eingaben.';

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

    // Verify Password Hash
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

    // Create new session
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
   * Log out and terminate session
   */
  async logout(token: string): Promise<boolean> {
    if (!token) return true;
    await userRepository.deleteSession(token);
    return true;
  }
}

export const authService = new AuthService();
