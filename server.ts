import 'express-async-errors';
import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/apiRoutes';
import { closeDbPool, getLastDatabaseStatus, testDatabaseConnection } from './server/config/database';
import { runMigrations } from './server/migrations/migrator';
import { ensureStorageInitialized } from './server/config/storage';
import { validateEnvironmentConfig } from './server/config/env';

dotenv.config();

const envValidation = validateEnvironmentConfig();
if (!envValidation.valid) {
  console.error('[Config] CRITICAL CONFIGURATION ERRORS:');
  envValidation.errors.forEach((err) => console.error(` - ${err}`));
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}
if (envValidation.warnings.length > 0) {
  envValidation.warnings.forEach((warn) => console.warn(`[Config] Hinweis: ${warn}`));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT) || 3000;

// Trust reverse proxy (Nginx Proxy Manager) headers
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));

// Request logging & Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Storage Directory Initialization on Server Start (Sprint 7)
ensureStorageInitialized().then((res) => {
  if (res.initialized) {
    console.log(`[Storage] Initialized media storage at ${res.path}`);
  } else {
    console.error(`[Storage] Warning: Media storage directory unavailable: ${res.error}`);
  }
});

// Centralized REST API Router (standard & v1 versioning per Section 38)
app.use('/api', apiRouter);
app.use('/api/v1', apiRouter);

// Catch-all for undefined /api and /api/* endpoints so they return JSON 404 instead of falling through to Vite HTML
app.all(['/api', '/api/*', '/api/v1', '/api/v1/*'], (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { message: `Endpunkt ${req.method} ${req.originalUrl || req.path} nicht gefunden.` },
  });
});

// Database Health & Auto-Migration bootstrap on server start
(async () => {
  try {
    const dbStatus = await testDatabaseConnection();
    if (dbStatus.connected) {
      console.log(`[Database] Connected to MariaDB at ${dbStatus.host}:${process.env.DB_PORT || 3306} (${dbStatus.latencyMs}ms)`);
      if (process.env.NODE_ENV !== 'production' || process.env.AUTO_MIGRATE === 'true') {
        const migrationRes = await runMigrations();
        console.log(`[Migrations] ${migrationRes.message}`);
      } else {
        console.log('[Migrations] Production mode: Automatische Migrationen übersprungen. Explizite Ausführung über CLI (npm run db:migrate) oder Admin Panel erforderlich.');
      }
    } else {
      console.log(`[Database] MariaDB status: ${dbStatus.diagnosticCode}. Data-backed API operations will fail; no in-memory repository fallback is enabled.`);
    }
  } catch (err: any) {
    console.warn('[Database] Initial connection check warning:', err.message);
  }
})();

// Vite Dev Server vs Production Static Asset Serving
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : '';
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

  if (code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, error: { message: 'Der Datensatz kollidiert mit einem vorhandenen Eintrag.' } });
  }

  if (code === 'MEDIA_REFERENCED') {
    return res.status(409).json({ success: false, error: { message: message || 'Diese Datei wird noch von einem Projekt oder Produkt verwendet.', code: 'MEDIA_REFERENCED' } });
  }

  const isDatabaseError =
    message.includes('MariaDB') ||
    code === 'DATABASE_UNAVAILABLE' ||
    code.startsWith('ECONN') ||
    code === 'ER_ACCESS_DENIED_ERROR' ||
    code === 'ER_BAD_DB_ERROR' ||
    !getLastDatabaseStatus().connected;

  if (isDatabaseError) {
    console.warn(`[Database] 503 Service Unavailable (${req.method} ${req.originalUrl || req.path}): ${message}`);
    const responseMessage = (req.originalUrl || req.path).startsWith('/api')
      ? message || 'MariaDB ist nicht erreichbar. Die Anfrage wurde nicht gespeichert.'
      : 'Interner Serverfehler.';
    return res.status(503).json({
      success: false,
      error: { message: responseMessage, code: 'DATABASE_UNAVAILABLE' },
    });
  }

  console.error(`[Server Error] (${req.method} ${req.originalUrl || req.path}):`, error);
  return res.status(500).json({ success: false, error: { message: 'Interner Serverfehler.' } });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Nexus Code Play Full-Stack Platform listening on http://0.0.0.0:${port}`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('[Server] HTTP listener closed.');
    await closeDbPool();
    console.log('[Server] Database pool closed. Graceful shutdown complete.');
    process.exit(0);
  });
  // Force exit after 10s if connections fail to close
  setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
