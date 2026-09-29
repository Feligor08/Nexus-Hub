import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  mediaStoragePath: path.resolve(process.env.MEDIA_STORAGE_PATH || 'var/media'),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'nexus_code_play',
    user: process.env.DB_USER || 'nexus_app',
    password: process.env.DB_PASSWORD || '',
    connectionLimit: Number(process.env.DB_POOL_MAX) || 10,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT) || 5000,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'nexus-dev-insecure-secret-key-change-in-prod',
  },
};
