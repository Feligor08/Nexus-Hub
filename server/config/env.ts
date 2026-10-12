import dotenv from 'dotenv';
import { MEDIA_STORAGE_PATH } from './storage';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || process.env.APP_ENV || 'development';
const isProd = nodeEnv === 'production';

export const config = {
  env: nodeEnv,
  isProd,
  port: Number(process.env.PORT) || 3000,
  appUrl: process.env.APP_URL || (isProd ? 'https://www.fs-nexus-systems.de' : 'http://localhost:3000'),
  sessionSecret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'nexus-dev-insecure-secret-key-change-in-prod',
  mediaStoragePath: MEDIA_STORAGE_PATH,
  db: {
    host: process.env.DB_HOST?.trim() || 'DB_HOST_NOT_CONFIGURED',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'nexus_code_play',
    user: process.env.DB_USER || 'nexus_app',
    password: process.env.DB_PASSWORD || '',
    poolMin: Number(process.env.DB_POOL_MIN) || 2,
    connectionLimit: Number(process.env.DB_POOL_MAX) || 10,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT) || 5000,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || process.env.SESSION_SECRET || 'nexus-dev-insecure-secret-key-change-in-prod',
  },
};

/**
 * Mask sensitive values so they never appear in logs or error traces
 */
export function redactSecret(value?: string | null): string {
  if (!value) return '[EMPTY]';
  if (value.length <= 4) return '****';
  return `${value.substring(0, 2)}****${value.substring(value.length - 2)}`;
}

/**
 * Validates environment configuration and warns or throws in production
 */
export function validateEnvironmentConfig(strict = isProd, customEnv = process.env): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  const insecurePlaceholders = [
    'nexus-dev-insecure-secret-key-change-in-prod',
    'your-session-secret-key-change-in-prod',
    'your-secure-database-password',
    'your-gemini-api-key',
  ];

  const sessionSecret = customEnv.SESSION_SECRET || customEnv.JWT_SECRET || (strict ? '' : config.sessionSecret);
  const dbHost = customEnv.DB_HOST?.trim() || (strict ? '' : config.db.host);
  const dbPassword = customEnv.DB_PASSWORD || '';

  if (strict) {
    if (!sessionSecret) {
      errors.push('SESSION_SECRET oder JWT_SECRET ist in Produktionsumgebungen zwingend erforderlich.');
    } else if (insecurePlaceholders.includes(sessionSecret)) {
      errors.push('SESSION_SECRET verwendet einen bekannten Standard-Platzhalter. Bitte ein sicheres Produktionsgeheimnis generieren.');
    }

    if (!dbHost || dbHost === 'DB_HOST_NOT_CONFIGURED') {
      errors.push('DB_HOST ist in der Produktionsumgebung nicht konfiguriert.');
    }

    if (!dbPassword || insecurePlaceholders.includes(dbPassword)) {
      warnings.push('DB_PASSWORD ist nicht gesetzt oder verwendet ein Standard-Passwort.');
    }
  } else {
    if (insecurePlaceholders.includes(sessionSecret)) {
      warnings.push('Entwicklungsmodus: Verwende für die Produktion ein individuelles SESSION_SECRET.');
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
