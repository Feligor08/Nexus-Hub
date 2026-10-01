import 'express-async-errors';
import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/apiRoutes';
import { getLastDatabaseStatus, testDatabaseConnection } from './server/config/database';
import { runMigrations } from './server/migrations/migrator';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Request logging & Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Centralized REST API Router (standard & v1 versioning per Section 38)
app.use('/api', apiRouter);
app.use('/api/v1', apiRouter);

// Database Health & Auto-Migration bootstrap on server start
(async () => {
  try {
    const dbStatus = await testDatabaseConnection();
    if (dbStatus.connected) {
      console.log(`[Database] Connected to MariaDB at ${dbStatus.host}:${process.env.DB_PORT || 3306} (${dbStatus.latencyMs}ms)`);
      const migrationRes = await runMigrations();
      console.log(`[Migrations] ${migrationRes.message}`);
    } else {
      console.log(`[Database] MariaDB status: DISCONNECTED (${dbStatus.error || 'Host unreachable'}). Data-backed API operations will fail; no in-memory repository fallback is enabled.`);
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
  console.error('Unhandled request error:', error);

  if (code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, error: { message: 'Der Datensatz kollidiert mit einem vorhandenen Eintrag.' } });
  }
  const databaseUnavailable = !getLastDatabaseStatus().connected &&
    (message.includes('MariaDB') || code.startsWith('ECONN') || code === 'DATABASE_UNAVAILABLE');
  const status = databaseUnavailable ? 503 : 500;
  const responseMessage = req.path.startsWith('/api') && databaseUnavailable
    ? 'MariaDB ist nicht erreichbar. Die Anfrage wurde nicht gespeichert.'
    : 'Interner Serverfehler.';
  return res.status(status).json({ success: false, error: { message: responseMessage } });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Nexus Code Play Full-Stack Platform listening on http://0.0.0.0:${port}`);
});
