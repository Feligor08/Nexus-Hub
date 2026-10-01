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
  errorCode?: 'VALIDATION' | 'CONFLICT';
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
  async register(input: RegisterDTO, clientIp?: string, userAgent?: string): Promise<AuthResult> {
    const dto = input && typeof input === 'object' ? input : {} as RegisterDTO;
    const username = typeof dto.username === 'string' ? dto.username.trim() : '';
    const email = typeof dto.email === 'string' ? dto.email.trim().toLowerCase() : '';
    const password = typeof dto.password === 'string' ? dto.password : '';
    const displayName = typeof dto.displayName === 'string' ? dto.displayName.trim() : '';

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

    if (!displayName || displayName.length > 100) {
      return { success: false, authenticated: false, errorCode: 'VALIDATION', error: 'Der Anzeigename muss zwischen 1 und 100 Zeichen lang sein.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || email.length > 191 || !emailRegex.test(email)) {
      return {
        success: false,
        authenticated: false,
        error: 'Bitte gib eine gültige E-Mail-Adresse ein.',
      };
    }

    if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      return {
        success: false,
        authenticated: false,
        error: 'Das Passwort muss mindestens 12 Zeichen lang sein und darf höchstens 72 UTF-8-Bytes umfassen.',
      };
    }

    // 2. Duplicate Checks
    const existingUsername = await userRepository.findByUsername(username);
    if (existingUsername) {
      return {
        success: false,
        authenticated: false,
        errorCode: 'CONFLICT',
        error: 'Dieser Benutzername ist bereits vergeben.',
      };
    }

    const existingEmail = await userRepository.findByEmail(email);
    if (existingEmail) {
      return {
        success: false,
        authenticated: false,
        errorCode: 'CONFLICT',
        error: 'Ein Konto mit dieser E-Mail-Adresse existiert bereits.',
      };
    }

    // 3. Password Hashing (bcrypt with salt rounds)
    const passwordHash = await userRepository.hashPassword(password);
    const userId = `usr-${crypto.randomUUID()}`;
    const token = this.generateSessionToken();

    // User, standard role, badge and initial session commit atomically.
    const createdUser = await userRepository.registerUser({
      id: userId,
      username,
      email,
      passwordHash,
      displayName,
    }, token, clientIp, userAgent);

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
  async login(input: LoginDTO, clientIp?: string, userAgent?: string): Promise<AuthResult> {
    const dto = input && typeof input === 'object' ? input : {} as LoginDTO;
    const rawIdentifier = typeof dto.email === 'string' ? dto.email.trim() : '';
    const identifier = rawIdentifier.includes('@') ? rawIdentifier.toLowerCase() : rawIdentifier;
    const password = typeof dto.password === 'string' ? dto.password : '';
    const genericAuthError = 'Ungültige Anmeldedaten.';

    if (!identifier || !password) {
      return {
        success: false,
        authenticated: false,
        error: genericAuthError,
      };
    }

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
        error: genericAuthError,
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

  async changePassword(userId: string, currentPassword: string, newPassword: string, currentSessionToken: string): Promise<AuthResult> {
    const genericError = 'Das aktuelle Passwort ist ungültig.';
    if (!currentPassword || !newPassword) {
      return { success: false, authenticated: true, error: 'Beide Passwortfelder sind erforderlich.' };
    }
    if (newPassword.length < 12 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      return { success: false, authenticated: true, error: 'Das neue Passwort muss mindestens 12 Zeichen lang sein und darf höchstens 72 UTF-8-Bytes umfassen.' };
    }

    const user = await userRepository.findById(userId);
    const credentials = user ? await userRepository.findWithCredentials(user.email) : null;
    if (!user || !credentials || !(await userRepository.verifyPassword(currentPassword, credentials.passwordHash || ''))) {
      return { success: false, authenticated: true, error: genericError };
    }

    const passwordHash = await userRepository.hashPassword(newPassword);
    const changed = await userRepository.changePassword(userId, passwordHash, currentSessionToken);
    if (!changed) return { success: false, authenticated: true, error: 'Benutzer nicht gefunden.' };
    return { success: true, authenticated: true, user: this.sanitizeUser(user) };
  }
}

export const authService = new AuthService();
