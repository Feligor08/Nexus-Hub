import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { getLastDatabaseStatus, executeQuery } from '../config/database';
import { databaseHealthService } from '../services/databaseHealthService';
import { authService } from '../services/authService';
import { projectRepository } from '../repositories/projectRepository';
import { productRepository } from '../repositories/productRepository';
import { orderRepository } from '../repositories/orderRepository';
import { communityRepository } from '../repositories/communityRepository';
import { aiConversationRepository } from '../repositories/aiConversationRepository';
import { userRepository } from '../repositories/userRepository';
import { auditRepository } from '../repositories/auditRepository';
import { mediaRepository } from '../repositories/mediaRepository';
import { downloadRepository } from '../repositories/downloadRepository';
import { cartRepository } from '../repositories/cartRepository';
import { creatorApplicationRepository } from '../repositories/creatorApplicationRepository';
import { runMigrations } from '../migrations/migrator';
import { authenticate, requireAuth, requireRole, AuthenticatedRequest, extractToken } from '../middleware/authMiddleware';
import {
  loginRateLimiter,
  registerRateLimiter,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '../middleware/rateLimitMiddleware';
import { mediaStorage, getUploadCategory } from '../services/mediaStorage';
import { config } from '../config/env';
import { db } from '../db';
import { User, Order, ProductVersion } from '../models/types';

export const apiRouter = Router();

// Enable session authentication across all API routes
apiRouter.use(authenticate);

// Shared Gemini Client with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const setSessionCookie = (res: Response, token: string) => {
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${config.isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', `nexus_session=${token}; ${flags}`);
};

const clearSessionCookie = (res: Response) => {
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', `nexus_session=; ${flags}`);
};

const logAudit = async (action: string, details: string, req: AuthenticatedRequest) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userId = req.user?.id || 'unauthenticated';
  const username = req.user?.username || 'anonymous';
  await auditRepository.log(action, userId, username, details, ip);
};

// -------------------------------------------------------------
// 1. HEALTH CHECKS & SYSTEM MONITORING (Sections 10, 11, 31, 32)
// -------------------------------------------------------------
apiRouter.get('/health', async (req: Request, res: Response) => {
  const dbHealth = await databaseHealthService.checkHealth();
  res.json({
    success: true,
    status: 'ONLINE',
    platform: 'Nexus Code Play',
    services: {
      api: 'ONLINE',
      database: dbHealth.database.connected ? 'CONNECTED' : 'DISCONNECTED',
      ai: process.env.GEMINI_API_KEY ? 'AVAILABLE' : 'DEGRADED',
      calendar: 'CONNECTED',
      storage: 'AVAILABLE',
    },
    database: {
      connected: dbHealth.database.connected,
      type: dbHealth.database.type,
      latencyMs: dbHealth.database.latencyMs,
    },
    infrastructure: {
      host: 'HP EliteDesk 800 G3 Mini',
      os: 'Ubuntu Server 24.04 LTS (CasaOS / Docker)',
      network: 'Tailscale Mesh-VPN',
    },
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/health/database', async (req: Request, res: Response) => {
  const result = await databaseHealthService.checkHealth();
  if (result.success) {
    res.json({
      success: true,
      database: {
        connected: true,
        type: result.database.type,
        host: result.database.host,
        database: result.database.database,
        latencyMs: result.database.latencyMs,
        checkedAt: result.database.checkedAt,
      },
    });
  } else {
    res.status(503).json({
      success: false,
      database: {
        connected: false,
        type: 'MariaDB',
        error: result.database.diagnosticCode || 'Connection refused or host unreachable',
        checkedAt: result.database.checkedAt,
      },
    });
  }
});

// Run MariaDB migrations endpoint (Admin only)
apiRouter.post('/database/migrate', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const migrationRes = await runMigrations();
  await logAudit('RUN_MIGRATIONS', migrationRes.message, req);

  if (migrationRes.success) {
    res.json({ success: true, data: migrationRes });
  } else {
    res.status(500).json({ success: false, error: migrationRes });
  }
});

// -------------------------------------------------------------
// 2. REAL AUTHENTICATION & USERS (Sections 4, 5, 6, 7, 8, 9, 10, 11)
// -------------------------------------------------------------

// Session Check Endpoint (Section 12 - Authenticated returns user, unauthenticated returns 401)
apiRouter.get('/auth/me', (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    res.json({
      success: true,
      authenticated: true,
      user: req.user,
      data: req.user,
    });
  } else {
    res.status(401).json({
      success: false,
      authenticated: false,
      user: null,
      data: null,
      error: { message: 'Nicht authentifiziert' },
    });
  }
});

// User Registration
apiRouter.post('/auth/register', registerRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  const result = await authService.register(req.body, ip, userAgent);
  if (!result.success || !result.user || !result.token) {
    return res.status(400).json({
      success: false,
      authenticated: false,
      error: { message: result.error || 'Registrierung fehlgeschlagen' },
    });
  }

  setSessionCookie(res, result.token);
  await auditRepository.log(
    'USER_REGISTER',
    result.user.id,
    result.user.username,
    `Neues Benutzerkonto registriert: ${result.user.email}`,
    ip
  );

  res.status(201).json({
    success: true,
    authenticated: true,
    user: result.user,
    data: result.user,
    token: result.token,
    message: 'Registrierung erfolgreich',
  });
});

// User Login
apiRouter.post('/auth/login', loginRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  const result = await authService.login(req.body, ip, userAgent);
  if (!result.success || !result.user || !result.token) {
    recordFailedLogin(req);
    await auditRepository.log(
      'AUTH_FAILED',
      'anonymous',
      req.body.email || req.body.emailOrUsername || req.body.username || 'unknown',
      `Fehlgeschlagener Anmeldeversuch für ${req.body.email || req.body.emailOrUsername || req.body.username || 'unbekannt'}`,
      ip
    );
    return res.status(401).json({
      success: false,
      authenticated: false,
      error: { message: result.error || 'Ungültige Anmeldedaten' },
    });
  }

  recordSuccessfulLogin(req);
  setSessionCookie(res, result.token);
  await auditRepository.log(
    'USER_LOGIN',
    result.user.id,
    result.user.username,
    `Erfolgreiche Anmeldung von ${ip}`,
    ip
  );

  res.json({
    success: true,
    authenticated: true,
    user: result.user,
    data: result.user,
    token: result.token,
    message: 'Erfolgreich angemeldet',
  });
});

// User Logout
apiRouter.post('/auth/logout', async (req: AuthenticatedRequest, res: Response) => {
  const token = req.sessionToken;
  if (token) {
    await authService.logout(token);
  }

  clearSessionCookie(res);
  await logAudit('USER_LOGOUT', 'Benutzer hat sich abgemeldet', req);

  res.json({
    success: true,
    authenticated: false,
    message: 'Erfolgreich abgemeldet',
  });
});

// Password Change (Supports POST /api/auth/change-password and POST /api/auth/password per Section 12)
const handlePasswordChange = async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user!.id, currentPassword, newPassword, req.sessionToken);

  if (!result.success || !result.newToken) {
    return res.status(400).json({
      success: false,
      error: { message: result.error || 'Passwortänderung fehlgeschlagen.' },
    });
  }

  setSessionCookie(res, result.newToken);
  await logAudit('PASSWORD_CHANGED', 'Passwort erfolgreich geändert und andere Sitzungen widerrufen', req);

  res.json({
    success: true,
    message: 'Passwort erfolgreich geändert. Andere Sitzungen wurden beendet.',
    token: result.newToken,
  });
};

apiRouter.post('/auth/change-password', requireAuth, handlePasswordChange);
apiRouter.post('/auth/password', requireAuth, handlePasswordChange);

// Session Management (Section 13)
apiRouter.get('/auth/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const sessions = await userRepository.getUserSessions(req.user!.id, req.sessionToken);
  res.json({ success: true, data: sessions });
});

apiRouter.post('/auth/logout-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionToken) {
    await userRepository.deleteOtherSessions(req.user!.id, req.sessionToken);
    await logAudit('SESSIONS_REVOKED', 'Alle anderen Sitzungen wurden widerrufen', req);
    res.json({ success: true, message: 'Alle anderen Sitzungen erfolgreich beendet' });
  } else {
    await userRepository.deleteUserSessions(req.user!.id);
    clearSessionCookie(res);
    res.json({ success: true, message: 'Alle Sitzungen erfolgreich beendet' });
  }
});

// Profile Management (Section 6 & 7: GET /api/profile/me, PATCH /api/profile/me, PUT /api/users/me)
apiRouter.get('/profile/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = await userRepository.findById(req.user!.id);
  if (!user) {
    return res.status(404).json({ success: false, error: { message: 'Benutzer nicht gefunden' } });
  }
  res.json({ success: true, data: authService.sanitizeUser(user) });
});

const handleProfileUpdate = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { username, displayName, bio, avatar, skills, technologies, githubUrl, websiteUrl, website, location } = req.body;

  // Username validation if changing username (Section 7)
  if (username !== undefined) {
    const cleanUser = String(username).trim().toLowerCase();
    if (cleanUser.length < 3 || cleanUser.length > 30) {
      return res.status(400).json({ success: false, error: { message: 'Der Benutzername muss zwischen 3 und 30 Zeichen lang sein.' } });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
      return res.status(400).json({ success: false, error: { message: 'Der Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten.' } });
    }
    // Check if taken by someone else
    const existing = await userRepository.findByUsername(cleanUser);
    if (existing && existing.id !== userId) {
      return res.status(400).json({ success: false, error: { message: 'Dieser Benutzername ist bereits vergeben.' } });
    }
  }

  // Location/Website validation
  const cleanWebsite = (website || websiteUrl || '').trim();
  const cleanLocation = (location || '').trim();

  try {
    const updated = await userRepository.updateProfile(userId, {
      username: username ? String(username).trim().toLowerCase() : undefined,
      displayName: displayName !== undefined ? String(displayName).trim() : undefined,
      bio: bio !== undefined ? String(bio).trim() : undefined,
      avatar: avatar !== undefined ? String(avatar).trim() : undefined,
      skills: Array.isArray(skills) ? skills : undefined,
      technologies: Array.isArray(technologies) ? technologies : undefined,
      githubUrl: githubUrl !== undefined ? String(githubUrl).trim() : undefined,
      websiteUrl: cleanWebsite || undefined,
      website: cleanWebsite || undefined,
      location: cleanLocation || undefined,
    });

    await logAudit('UPDATE_PROFILE', 'Benutzerprofil aktualisiert', req);
    res.json({
      success: true,
      user: updated ? authService.sanitizeUser(updated) : null,
      data: updated ? authService.sanitizeUser(updated) : null,
      message: 'Profil erfolgreich gespeichert',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Fehler beim Speichern des Profils' } });
  }
};

apiRouter.patch('/profile/me', requireAuth, handleProfileUpdate);
apiRouter.put('/users/me', requireAuth, handleProfileUpdate);

// Creator Application Workflow (Sections 15, 16, 17)
apiRouter.get('/creator/application', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const application = await creatorApplicationRepository.findByUserId(req.user!.id);
  res.json({ success: true, data: application });
});

apiRouter.post('/creator/apply', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { motivation, plannedProjects, plannedContent, portfolioUrl } = req.body;
  if (!motivation || !plannedProjects || !plannedContent) {
    return res.status(400).json({
      success: false,
      error: { message: 'Bitte fülle alle Pflichtfelder (Motivation, geplante Projekte und Inhalte) aus.' },
    });
  }

  const existing = await creatorApplicationRepository.findByUserId(req.user!.id);
  if (existing && existing.status === 'PENDING') {
    return res.status(400).json({
      success: false,
      error: { message: 'Du hast bereits eine offene Creator-Bewerbung eingereicht. Bitte warte auf die Überprüfung.' },
    });
  }

  const app = await creatorApplicationRepository.create({
    userId: req.user!.id,
    portfolioUrl: portfolioUrl ? String(portfolioUrl).trim() : undefined,
    motivation: String(motivation).trim(),
    plannedProjects: String(plannedProjects).trim(),
    plannedContent: String(plannedContent).trim(),
  });

  await logAudit('CREATOR_APPLICATION_SUBMITTED', `Creator-Bewerbung eingereicht von ${req.user!.username}`, req);
  res.status(201).json({
    success: true,
    data: app,
    message: 'Creator-Bewerbung erfolgreich eingereicht! Ein Administrator wird sie prüfen.',
  });
});

// Admin Review of Creator Applications
apiRouter.get('/admin/creator-applications', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { status, page, limit } = req.query;
  const result = await creatorApplicationRepository.findAll({
    status: status ? String(status) : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ success: true, data: result.applications, total: result.total });
});

apiRouter.post('/admin/creator-applications/:id/review', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { status, adminNotes } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ success: false, error: { message: 'Ungültiger Review-Status (APPROVED oder REJECTED)' } });
  }

  const reviewed = await creatorApplicationRepository.review(
    req.params.id,
    status,
    req.user!.id,
    adminNotes
  );

  if (!reviewed) {
    return res.status(404).json({ success: false, error: { message: 'Bewerbung nicht gefunden' } });
  }

  if (status === 'APPROVED') {
    await userRepository.updateRole(reviewed.userId, 'CREATOR');
    await logAudit('CREATOR_APPROVED', `Creator-Bewerbung genehmigt für User ${reviewed.userId}`, req);
  } else {
    await logAudit('CREATOR_REJECTED', `Creator-Bewerbung abgelehnt für User ${reviewed.userId}`, req);
  }

  res.json({
    success: true,
    data: reviewed,
    message: status === 'APPROVED' ? 'Bewerbung genehmigt und CREATOR-Rolle vergeben.' : 'Bewerbung abgelehnt.',
  });
});

// Public User Profile
apiRouter.get('/users/:username', async (req: Request, res: Response) => {
  const user = await userRepository.findByUsername(req.params.username);
  if (!user) {
    return res.status(404).json({ success: false, error: { message: 'Benutzer nicht gefunden' } });
  }
  res.json({ success: true, data: authService.sanitizeUser(user) });
});

// -------------------------------------------------------------
// 3. PROJECTS / PORTFOLIO API (Sections 17, 18, 19, 20)
// -------------------------------------------------------------
apiRouter.get('/projects', async (req: Request, res: Response) => {
  const { category, search, page, limit, status, includeDrafts } = req.query;
  try {
    const result = await projectRepository.findAll({
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      includeDrafts: includeDrafts === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ success: true, data: result.projects, total: result.total });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar. Projekte sind derzeit nicht verfügbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

// Explicit Public Projects API (Sprint 7, Section 21: Exclusively PUBLISHED & PUBLIC items)
apiRouter.get('/projects/public', async (req: Request, res: Response) => {
  const { category, search, page, limit } = req.query;
  try {
    const result = await projectRepository.findAll({
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      includeDrafts: false,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ success: true, data: result.projects, total: result.total });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar. Projekte sind derzeit nicht verfügbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

apiRouter.get('/projects/featured', async (req: Request, res: Response) => {
  try {
    const result = await projectRepository.findAll({ featured: true, status: 'PUBLISHED', visibility: 'PUBLIC', limit: 6 });
    res.json({ success: true, data: result.projects });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar. Projekte sind derzeit nicht verfügbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

apiRouter.get('/projects/:slug', async (req: Request, res: Response) => {
  try {
    const project = await projectRepository.findBySlug(req.params.slug);
    if (!project) {
      return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
    }
    res.json({ success: true, data: project });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar. Projekte sind derzeit nicht verfügbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

apiRouter.post('/projects', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const authorId = req.user!.role === 'ADMIN' && req.body.authorId ? req.body.authorId : req.user!.id;
  const projectData = {
    ...req.body,
    authorId,
  };

  const created = await projectRepository.create(projectData);
  await logAudit('CREATE_PROJECT', `Projekt erstellt: ${created.title}`, req);
  res.status(201).json({ success: true, data: created });
});

apiRouter.put('/projects/:id', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const updated = await projectRepository.update(req.params.id, req.body, authorCheck);
  if (!updated) {
    return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden oder keine Berechtigung' } });
  }
  await logAudit('UPDATE_PROJECT', `Projekt aktualisiert: ${updated.title}`, req);
  res.json({ success: true, data: updated });
});

// Project Publishing Endpoint (Sprint 7, Section 19: DRAFT -> PREVIEW -> VALIDATE -> PUBLISHED)
apiRouter.post('/projects/:id/publish', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const project = await projectRepository.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
  }
  if (authorCheck && project.authorId !== authorCheck) {
    return res.status(403).json({ success: false, error: { message: 'Keine Berechtigung zur Veröffentlichung dieses Projekts' } });
  }

  // Strict Validation of required fields
  const missing: string[] = [];
  if (!project.title || project.title.trim().length < 3) missing.push('Titel (mindestens 3 Zeichen)');
  if (!project.slug || project.slug.trim().length === 0) missing.push('Slug');
  if (!project.shortDesc && !project.description) missing.push('Beschreibung oder Kurzbeschreibung');
  if (!project.authorId) missing.push('Autor-ID');

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Veröffentlichung abgelehnt: Pflichtfelder fehlen (${missing.join(', ')}).`,
        missingFields: missing,
      },
    });
  }

  const updated = await projectRepository.update(
    req.params.id,
    {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt: new Date().toISOString(),
    },
    authorCheck
  );

  await logAudit('PROJECT_PUBLISHED', `Projekt veröffentlicht: ${project.title} (${project.id})`, req);
  res.json({ success: true, data: updated, message: 'Projekt erfolgreich veröffentlicht.' });
});

// Project Unpublish Endpoint (Sprint 7, Section 22)
apiRouter.post('/projects/:id/unpublish', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const project = await projectRepository.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
  }
  if (authorCheck && project.authorId !== authorCheck) {
    return res.status(403).json({ success: false, error: { message: 'Keine Berechtigung zum Zurückziehen dieses Projekts' } });
  }

  const updated = await projectRepository.update(
    req.params.id,
    {
      status: 'DRAFT',
      publishedAt: undefined,
    },
    authorCheck
  );

  await logAudit('PROJECT_UNPUBLISHED', `Projekt zurückgezogen (DRAFT): ${project.title}`, req);
  res.json({ success: true, data: updated, message: 'Projekt erfolgreich auf Entwurf (DRAFT) zurückgesetzt.' });
});

apiRouter.patch('/projects/:id/status', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
    return res.status(400).json({ success: false, error: { message: 'Ungültiger Status' } });
  }
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const updated = await projectRepository.update(req.params.id, { status }, authorCheck);
  if (!updated) {
    return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden oder keine Berechtigung' } });
  }
  await logAudit('PROJECT_STATUS_CHANGED', `Projekt-Status: ${updated.title} -> ${status}`, req);
  res.json({ success: true, data: updated });
});

apiRouter.delete('/projects/:id', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const success = await projectRepository.delete(req.params.id, authorCheck);
  if (!success) {
    return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden oder keine Berechtigung' } });
  }
  await logAudit('DELETE_PROJECT', `Projekt gelöscht: ${req.params.id}`, req);
  res.json({ success: true, message: 'Projekt erfolgreich gelöscht' });
});

// -------------------------------------------------------------
// 4. PRODUCTS & STORE (Sections 21, 22, 23)
// -------------------------------------------------------------
apiRouter.get('/products', async (req: Request, res: Response) => {
  const { category, search, page, limit, status, includeDrafts } = req.query;
  try {
    const result = await productRepository.findAll({
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      includeDrafts: includeDrafts === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ success: true, data: result.products, total: result.total });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar. Produktdaten sind derzeit nicht verfügbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

// Explicit Public Products API (Sprint 7, Section 21: Exclusively PUBLISHED & PUBLIC items)
apiRouter.get('/products/public', async (req: Request, res: Response) => {
  const { category, search, page, limit } = req.query;
  try {
    const result = await productRepository.findAll({
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
      status: 'PUBLISHED',
      includeDrafts: false,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ success: true, data: result.products, total: result.total });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar. Produktdaten sind derzeit nicht verfügbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

apiRouter.get('/products/featured', async (req: Request, res: Response) => {
  try {
    const result = await productRepository.findAll({ featured: true, status: 'PUBLISHED', limit: 6 });
    res.json({ success: true, data: result.products });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar. Produktdaten sind derzeit nicht verfügbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

apiRouter.get('/products/:slug', async (req: Request, res: Response) => {
  try {
    const product = await productRepository.findBySlug(req.params.slug);
    if (!product) {
      return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden' } });
    }
    res.json({ success: true, data: product });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar. Produktdaten sind derzeit nicht verfügbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

apiRouter.post('/products', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const authorId = req.user!.role === 'ADMIN' && req.body.authorId ? req.body.authorId : req.user!.id;
  const productData = {
    ...req.body,
    authorId,
  };
  const created = await productRepository.create(productData);
  await logAudit('CREATE_PRODUCT', `Produkt erstellt: ${created.name}`, req);
  res.status(201).json({ success: true, data: created });
});

apiRouter.put('/products/:id', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const updated = await productRepository.update(req.params.id, req.body, authorCheck);
  if (!updated) {
    return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden oder keine Berechtigung' } });
  }
  await logAudit('UPDATE_PRODUCT', `Produkt aktualisiert: ${updated.name}`, req);
  res.json({ success: true, data: updated });
});

// Product Publishing Endpoint (Sprint 7, Section 20: DRAFT -> PREVIEW -> VALIDATE -> PUBLISHED)
apiRouter.post('/products/:id/publish', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const product = await productRepository.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden' } });
  }
  if (authorCheck && product.authorId !== authorCheck) {
    return res.status(403).json({ success: false, error: { message: 'Keine Berechtigung zur Veröffentlichung dieses Produkts' } });
  }

  // Strict Validation of required fields
  const missing: string[] = [];
  if (!product.name || product.name.trim().length < 3) missing.push('Produktname (mindestens 3 Zeichen)');
  if (!product.slug || product.slug.trim().length === 0) missing.push('Slug');
  if (typeof product.price !== 'number' || isNaN(product.price) || product.price < 0) missing.push('Gültiger Preis (>= 0)');
  if (!product.currency) missing.push('Währung (z.B. EUR)');
  if (!product.category) missing.push('Kategorie');
  if (!product.shortDesc && !product.description) missing.push('Beschreibung oder Kurzbeschreibung');
  if (product.digitalProduct && !product.downloadMediaId && !product.mediaFileId && !product.fileFormat) {
    missing.push('Digitale Download-Datei oder Dateiformat');
  }

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Veröffentlichung abgelehnt: Pflichtfelder fehlen (${missing.join(', ')}).`,
        missingFields: missing,
      },
    });
  }

  const updated = await productRepository.update(
    req.params.id,
    {
      status: 'PUBLISHED',
      published: true,
      visibility: 'PUBLIC',
      publishedAt: new Date().toISOString(),
    },
    authorCheck
  );

  await logAudit('PRODUCT_PUBLISHED', `Produkt veröffentlicht: ${product.name} (${product.id})`, req);
  res.json({ success: true, data: updated, message: 'Produkt erfolgreich veröffentlicht.' });
});

// Product Unpublish Endpoint (Sprint 7, Section 22)
apiRouter.post('/products/:id/unpublish', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const product = await productRepository.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden' } });
  }
  if (authorCheck && product.authorId !== authorCheck) {
    return res.status(403).json({ success: false, error: { message: 'Keine Berechtigung zum Zurückziehen dieses Produkts' } });
  }

  const updated = await productRepository.update(
    req.params.id,
    {
      status: 'DRAFT',
      published: false,
      publishedAt: undefined,
    },
    authorCheck
  );

  await logAudit('PRODUCT_UNPUBLISHED', `Produkt zurückgezogen (DRAFT): ${product.name}`, req);
  res.json({ success: true, data: updated, message: 'Produkt erfolgreich auf Entwurf (DRAFT) zurückgesetzt.' });
});

apiRouter.patch('/products/:id/status', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
    return res.status(400).json({ success: false, error: { message: 'Ungültiger Status' } });
  }
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const updated = await productRepository.update(req.params.id, { status, published: status === 'PUBLISHED' }, authorCheck);
  if (!updated) {
    return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden oder keine Berechtigung' } });
  }
  await logAudit('PRODUCT_STATUS_CHANGED', `Produkt-Status: ${updated.name} -> ${status}`, req);
  res.json({ success: true, data: updated });
});

apiRouter.delete('/products/:id', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const success = await productRepository.delete(req.params.id, authorCheck);
  if (!success) {
    return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden oder keine Berechtigung' } });
  }
  await logAudit('DELETE_PRODUCT', `Produkt gelöscht: ${req.params.id}`, req);
  res.json({ success: true, message: 'Produkt gelöscht' });
});

// Claim free product (Price === 0)
apiRouter.post('/products/:id/claim-free', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const product = await productRepository.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden' } });
  }
  if (product.price > 0) {
    return res.status(400).json({ success: false, error: { message: 'Dieses Produkt ist nicht kostenlos' } });
  }

  const orderId = `ord-free-${Date.now()}`;
  const order: Order = {
    id: orderId,
    userId: req.user!.id,
    customerEmail: req.user!.email,
    items: [{
      productId: product.id,
      name: product.name,
      price: 0,
      quantity: 1,
      fileFormat: product.fileFormat,
    }],
    totalAmount: 0,
    currency: product.currency || 'EUR',
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    downloadToken: `dl-free-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  await orderRepository.create(order);
  const ent = await downloadRepository.createEntitlement(req.user!.id, product.id, order.id);
  const tokenData = await downloadRepository.createDownloadToken(ent.id, req.user!.id, 72);

  await logAudit('CLAIM_FREE_PRODUCT', `Kostenloses Produkt freigeschaltet: ${product.name}`, req);

  res.json({
    success: true,
    message: 'Kostenloses Produkt erfolgreich freigeschaltet!',
    data: {
      order,
      entitlement: ent,
      downloadToken: tokenData.token,
      expiresAt: tokenData.expiresAt,
    },
  });
});

// Product versions
apiRouter.get('/products/:id/versions', async (req: Request, res: Response) => {
  const dbStatus = getLastDatabaseStatus();
  if (dbStatus.connected) {
    try {
      const rows = await executeQuery<any>(
        `SELECT id, product_id as productId, version, release_notes as releaseNotes, media_id as mediaId, created_at as createdAt
         FROM product_versions WHERE product_id = ? ORDER BY created_at DESC`,
        [req.params.id]
      );
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.warn('Failed to fetch product versions from MariaDB:', err);
    }
  }
  res.json({ success: true, data: [] });
});

apiRouter.post('/products/:id/versions', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { version, releaseNotes, mediaId } = req.body;
  if (!version) {
    return res.status(400).json({ success: false, error: { message: 'Versionsnummer erforderlich' } });
  }
  const id = `ver-${Date.now()}`;
  const dbStatus = getLastDatabaseStatus();
  if (!dbStatus.connected) {
    return res.status(503).json({ success: false, error: { message: 'MariaDB ist nicht erreichbar. Version konnte nicht angelegt werden.' } });
  }

  await executeQuery(
    `INSERT INTO product_versions (id, product_id, version, release_notes, media_id, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [id, req.params.id, version, releaseNotes || null, mediaId || null]
  );

  const newVer: ProductVersion = {
    id,
    productId: req.params.id,
    version,
    releaseNotes: releaseNotes || '',
    mediaId,
    createdAt: new Date().toISOString(),
  };

  await productRepository.update(req.params.id, { version });
  await logAudit('CREATE_PRODUCT_VERSION', `Version ${version} für Produkt ${req.params.id} veröffentlicht`, req);
  res.status(201).json({ success: true, data: newVer });
});

// -------------------------------------------------------------
// 5. CARTS & ORDERS (Sections 24, 25, 26, 41)
// -------------------------------------------------------------
apiRouter.get('/cart', async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = (req.headers['x-session-id'] as string) || req.cookies?.nexus_session;
  const items = await cartRepository.getCart(req.user?.id, sessionId);
  res.json({ success: true, data: items });
});

apiRouter.post('/cart', async (req: AuthenticatedRequest, res: Response) => {
  const { productId, quantity = 1 } = req.body;
  const sessionId = (req.headers['x-session-id'] as string) || req.cookies?.nexus_session;
  try {
    const items = await cartRepository.addItem(productId, Number(quantity) || 1, req.user?.id, sessionId);
    res.json({ success: true, data: items });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message || 'Produkt nicht gefunden' } });
  }
});

apiRouter.patch('/cart/:productId', async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  const sessionId = (req.headers['x-session-id'] as string) || req.cookies?.nexus_session;
  const items = await cartRepository.updateQuantity(productId, Number(quantity), req.user?.id, sessionId);
  res.json({ success: true, data: items });
});

apiRouter.delete('/cart/:productId', async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;
  const sessionId = (req.headers['x-session-id'] as string) || req.cookies?.nexus_session;
  const items = await cartRepository.removeItem(productId, req.user?.id, sessionId);
  res.json({ success: true, data: items });
});

apiRouter.post('/cart/clear', async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = (req.headers['x-session-id'] as string) || req.cookies?.nexus_session;
  await cartRepository.clearCart(req.user?.id, sessionId);
  res.json({ success: true, message: 'Warenkorb geleert' });
});

apiRouter.post('/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = (req.headers['x-session-id'] as string) || req.cookies?.nexus_session;
  const cartItems = await cartRepository.getCart(req.user!.id, sessionId);

  if (cartItems.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'Warenkorb ist leer' } });
  }

  // Price security: load verified product from database to calculate actual price
  const orderItems: any[] = [];
  let calculatedTotal = 0;

  for (const item of cartItems) {
    const p = await productRepository.findById(item.productId);
    if (!p) continue;

    const unitPrice = Number(p.price);
    const qty = Math.max(1, item.quantity);
    calculatedTotal += unitPrice * qty;

    orderItems.push({
      productId: p.id,
      name: p.name,
      price: unitPrice,
      quantity: qty,
      fileFormat: p.fileFormat || 'ZIP',
    });
  }

  if (orderItems.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'Keine gültigen Produkte im Warenkorb' } });
  }

  const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const downloadToken = `dl-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
  const totalAmount = Number(calculatedTotal.toFixed(2));
  const isFreeOrder = totalAmount === 0;

  const order: Order = {
    id: orderId,
    userId: req.user!.id,
    customerEmail: req.user!.email,
    items: orderItems,
    totalAmount,
    currency: 'EUR',
    status: isFreeOrder ? 'COMPLETED' : 'PENDING',
    paymentStatus: isFreeOrder ? 'NOT_REQUIRED' : 'PENDING',
    downloadToken: isFreeOrder ? downloadToken : '',
    createdAt: new Date().toISOString(),
  };

  const createdOrder = await orderRepository.create(order);
  await cartRepository.clearCart(req.user!.id, sessionId);

  // Digital download entitlements are ONLY issued for verified 0 EUR products or confirmed payments
  if (isFreeOrder) {
    for (const item of orderItems) {
      try {
        const ent = await downloadRepository.createEntitlement(req.user!.id, item.productId, order.id);
        await downloadRepository.createDownloadToken(ent.id, req.user!.id, 72, downloadToken);
      } catch (e) {
        console.warn('Could not create entitlement:', e);
      }
    }
  }

  await logAudit('ORDER_CREATED', `Bestellung ${order.id} über ${order.totalAmount} EUR erstellt (Status: ${order.status})`, req);

  res.json({
    success: true,
    data: createdOrder,
    message: isFreeOrder
      ? 'Kostenlose Bestellung erfolgreich abgeschlossen. Downloads freigeschaltet.'
      : 'Bestellung erfolgreich aufgenommen. Download-Freischaltung erfolgt nach bestätigtem Zahlungseingang.',
  });
});

apiRouter.get('/orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const orders = await orderRepository.findByUserId(req.user!.id);
  res.json({ success: true, data: orders });
});

apiRouter.get('/orders/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const orders = await orderRepository.findByUserId(req.user!.id);
  const found = orders.find((o) => o.id === req.params.id);
  if (!found && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: { message: 'Bestellung nicht gefunden oder Zugriff verweigert' } });
  }
  res.json({ success: true, data: found });
});

// -------------------------------------------------------------
// 5.1 DIGITAL DOWNLOADS & SECURE TOKEN SYSTEM (Sections 13, 14, 15)
// -------------------------------------------------------------
apiRouter.get('/downloads/entitlements', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const entitlements = await downloadRepository.getUserEntitlements(req.user!.id);
  res.json({ success: true, data: entitlements });
});

apiRouter.post('/downloads/token/:entitlementId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { entitlementId } = req.params;
  const userEnts = await downloadRepository.getUserEntitlements(req.user!.id);
  const found = userEnts.find((e) => e.id === entitlementId || e.productId === entitlementId);
  if (!found) {
    return res.status(403).json({ success: false, error: { message: 'Keine Download-Berechtigung für dieses Produkt gefunden' } });
  }

  const tokenData = await downloadRepository.createDownloadToken(found.id, req.user!.id, 24);
  await logAudit('GENERATE_DOWNLOAD_TOKEN', `Download-Token für ${found.productName} generiert`, req);
  res.json({
    success: true,
    data: {
      token: tokenData.token,
      expiresAt: tokenData.expiresAt,
      downloadUrl: `/api/downloads/file/${tokenData.token}`,
    },
  });
});

// Server-side controlled, authorized file delivery with verified token (NO static URLs!)
apiRouter.get('/downloads/file/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  const result = await downloadRepository.verifyAndConsumeToken(token);
  if (!result.valid || !result.product) {
    return res.status(403).json({ success: false, error: { message: result.error || 'Ungültiger Download-Token' } });
  }

  const product = result.product;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  // Check if product has an attached media file in media storage
  const assignedMediaId = product.downloadMediaId || product.mediaFileId;
  if (assignedMediaId) {
    try {
      const media = await mediaRepository.findById(assignedMediaId);
      if (media && media.storageKey) {
        await auditRepository.log('FILE_DOWNLOADED', result.entitlement?.userId || 'unknown', 'Customer', `Download: ${media.originalName} (${media.id})`, ip);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(media.originalName)}"`);
        res.setHeader('Content-Type', media.mimeType || 'application/octet-stream');
        res.setHeader('Content-Length', media.fileSize);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const stream = mediaStorage.createReadStream(media.storageKey);
        stream.on('error', () => {
          if (!res.headersSent) {
            res.status(404).json({ success: false, error: { message: 'Quelldatei im Storage nicht gefunden' } });
          }
        });
        return stream.pipe(res);
      }
    } catch (err) {
      console.warn('Could not stream media file for download:', err);
    }
  }

  const safeFilename = `${product.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}_v${product.version || '1.0.0'}.${(product.fileFormat || 'zip').toLowerCase()}`;
  await auditRepository.log('FILE_DOWNLOADED', result.entitlement?.userId || 'unknown', 'Customer', `Download: ${safeFilename}`, ip);

  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const payload = Buffer.from(
    `===============================================================================\n` +
    `NEXUS CODE PLAY — OFFICIAL DIGITAL ASSET DISTRIBUTION\n` +
    `Product: ${product.name}\n` +
    `Version: ${product.version || '1.0.0'}\n` +
    `Category: ${product.category}\n` +
    `Format: ${product.fileFormat}\n` +
    `License: ${product.license}\n` +
    `Target: HP EliteDesk 800 G3 Mini (MariaDB 11 / CasaOS / Docker)\n` +
    `Entitlement ID: ${result.entitlement?.id}\n` +
    `Issued At: ${new Date().toISOString()}\n` +
    `===============================================================================\n\n` +
    `[DESCRIPTION]\n${product.description}\n\n` +
    `[DOCUMENTATION]\n${product.documentationUrl || 'https://nexus.local/docs'}\n\n` +
    `[TOKEN AUTHORIZATION]\nServer-verified token: ${token.substring(0, 10)}... [OK]\n`
  );

  res.send(payload);
});

// -------------------------------------------------------------
// 5.2 MEDIA MANAGEMENT API (Sections 19, 21)
// -------------------------------------------------------------
apiRouter.get('/media', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const isAll = req.user?.role === 'ADMIN' && req.query.all === 'true';
  const ownerId = isAll ? undefined : req.user!.id;
  const category = req.query.category ? String(req.query.category) : undefined;
  const list = await mediaRepository.findAll({ ownerId, fileCategory: category });
  res.json({ success: true, data: list });
});

apiRouter.post('/media', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { filename, originalName, mimeType, fileSize, fileCategory } = req.body;
  if (!filename) {
    return res.status(400).json({ success: false, error: { message: 'Dateiname erforderlich' } });
  }
  const id = `med-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const media = await mediaRepository.create({
    id,
    ownerId: req.user!.id,
    filename,
    originalName: originalName || filename,
    mimeType: mimeType || 'application/octet-stream',
    fileSize: fileSize || 1024,
    fileCategory: fileCategory || 'file',
  });
  await logAudit('UPLOAD_MEDIA', `Medienobjekt hinzugefügt: ${filename}`, req);
  res.status(201).json({ success: true, data: media });
});

apiRouter.post('/media/upload', requireAuth, mediaStorage.uploadSingle('file'), async (req: AuthenticatedRequest, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: { message: 'Keine Datei übertragen' } });
  }
  const isSignatureValid = await mediaStorage.verifyFile(file.path, file.originalname);
  if (!isSignatureValid) {
    await mediaStorage.remove(file.filename).catch(() => {});
    return res.status(400).json({ success: false, error: { message: 'Ungültige Dateisignatur oder abweichender Dateityp.' } });
  }
  const category = getUploadCategory(file.originalname, file.mimetype) || 'file';
  const id = `med-${randomUUID()}`;

  try {
    const media = await mediaRepository.create({
      id,
      ownerId: req.user!.id,
      filename: file.originalname,
      originalName: file.originalname,
      storageKey: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
      fileCategory: category,
    });
    await logAudit('UPLOAD_MEDIA', `Medienobjekt hochgeladen: ${file.originalname} (${id})`, req);
    res.status(201).json({ success: true, data: media });
  } catch (err: any) {
    // ATOMICITY (Sprint 7, Section 12): If DB insert fails, delete uploaded file immediately from disk
    await mediaStorage.remove(file.filename).catch(() => {});
    throw err;
  }
});

apiRouter.get('/media/:id/file', async (req: Request, res: Response) => {
  const media = await mediaRepository.findById(req.params.id);
  if (!media) {
    return res.status(404).json({ success: false, error: { message: 'Mediendatei nicht gefunden' } });
  }

  if (media.storageKey) {
    const isPublic = await mediaRepository.isPubliclyLinked(media.id);
    if (!isPublic) {
      const token = extractToken(req);
      const user = token ? await authService.validateSession(token) : null;
      const isOwner = user && (user.id === media.ownerId || user.role === 'ADMIN' || user.roles?.includes('ADMIN'));
      if (!isOwner) {
        return res.status(403).json({ success: false, error: { message: 'Zugriff verweigert' } });
      }
    }

    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Length', media.fileSize);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(media.originalName)}"`);
    const stream = mediaStorage.createReadStream(media.storageKey);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ success: false, error: { message: 'Datei auf dem Server nicht gefunden' } });
    });
    return stream.pipe(res);
  }

  return res.redirect(media.storagePath);
});

apiRouter.delete('/media/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  try {
    const file = await mediaRepository.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ success: false, error: { message: 'Datei nicht gefunden' } });
    }
    if (authorCheck && file.ownerId !== authorCheck) {
      return res.status(403).json({ success: false, error: { message: 'Keine Berechtigung zum Löschen dieser Datei' } });
    }

    const success = await mediaRepository.delete(req.params.id, authorCheck);
    if (!success) {
      return res.status(404).json({ success: false, error: { message: 'Datei nicht gefunden oder keine Berechtigung' } });
    }

    // Physical storage cleanup (Sprint 7, Section 13)
    if (file.storageKey) {
      try {
        await mediaStorage.remove(file.storageKey);
      } catch (err) {
        console.warn('Physical storage remove warning:', err);
      }
    }

    await logAudit('DELETE_MEDIA', `Medienobjekt gelöscht: ${req.params.id}`, req);
    res.json({ success: true, message: 'Datei gelöscht' });
  } catch (err: any) {
    if (err.code === 'MEDIA_REFERENCED') {
      return res.status(409).json({
        success: false,
        error: { message: err.message || 'Diese Datei wird noch von einem Projekt oder Produkt verwendet.', code: 'MEDIA_REFERENCED' },
      });
    }
    throw err;
  }
});

// -------------------------------------------------------------
// 5.3 CONTENT MANAGEMENT SYSTEM (CMS) DASHBOARD STATS (Section 6)
// -------------------------------------------------------------
apiRouter.get('/cms/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const isCreatorOrAdmin = req.user?.role === 'CREATOR' || req.user?.role === 'ADMIN' || req.user?.roles?.includes('CREATOR') || req.user?.roles?.includes('ADMIN');
  if (!isCreatorOrAdmin) {
    return res.status(403).json({ success: false, error: { message: 'Creator- oder Administrator-Rolle erforderlich' } });
  }

  const userId = req.user!.id;
  const filterByAuthor = req.user?.role === 'ADMIN' ? undefined : userId;

  try {
    const [projResult, prodResult, posts] = await Promise.all([
      projectRepository.findAll({ authorId: filterByAuthor, includeDrafts: true, limit: 100 }),
      productRepository.findAll({ authorId: filterByAuthor, includeDrafts: true, limit: 100 }),
      communityRepository.getPosts(),
    ]);

    const projects = projResult.projects;
    const products = prodResult.products;
    const userMedia = await mediaRepository.findAll(filterByAuthor ? { ownerId: filterByAuthor } : undefined);

    const draftsCount =
      projects.filter((p) => p.status === 'DRAFT').length +
      products.filter((p) => p.status === 'DRAFT').length;

    const publishedCount =
      projects.filter((p) => p.status === 'PUBLISHED').length +
      products.filter((p) => p.status === 'PUBLISHED').length;

    const archivedCount =
      projects.filter((p) => p.status === 'ARCHIVED').length +
      products.filter((p) => p.status === 'ARCHIVED').length;

    res.json({
      success: true,
      data: {
        totalProjects: projects.length,
        totalProducts: products.length,
        totalPosts: posts.length,
        totalMedia: userMedia.length,
        draftsCount,
        publishedCount,
        archivedCount,
        projects,
        products,
      },
    });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar. CMS-Statistiken sind derzeit nicht verfügbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

// -------------------------------------------------------------
// 6. COMMUNITY API (Section 27 & RBAC Moderation)
// -------------------------------------------------------------
apiRouter.get('/community/posts', async (req: Request, res: Response) => {
  const { category, search, tag } = req.query;
  try {
    const posts = await communityRepository.getPosts({
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
      tag: tag ? String(tag) : undefined,
    });
    res.json({ success: true, data: posts });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar. Community-Beiträge sind derzeit nicht verfügbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

apiRouter.get('/community/posts/:id', async (req: Request, res: Response) => {
  try {
    const post = await communityRepository.getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: { message: 'Beitrag nicht gefunden.' } });
    }
    res.json({ success: true, data: post });
  } catch (err: any) {
    if (!getLastDatabaseStatus().connected || err.message?.includes('MariaDB')) {
      return res.status(503).json({
        success: false,
        error: { message: 'MariaDB ist nicht erreichbar.', code: 'DATABASE_UNAVAILABLE' },
      });
    }
    throw err;
  }
});

apiRouter.post('/community/posts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { title, content, category, tags = [] } = req.body;
  if (!title || !content) {
    return res.status(400).json({ success: false, error: { message: 'Titel und Inhalt sind erforderlich' } });
  }

  const post = await communityRepository.createPost({
    id: `post-${Date.now()}`,
    authorId: req.user!.id,
    authorName: req.user!.displayName,
    authorUsername: req.user!.username,
    authorAvatar: req.user!.avatar,
    title,
    content,
    category: category || 'General',
    tags,
    likes: 0,
    comments: [],
    createdAt: new Date().toISOString(),
  });

  await logAudit('CREATE_POST', `Beitrag erstellt: ${post.title}`, req);
  res.status(201).json({ success: true, data: post });
});

apiRouter.put('/community/posts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { title, content, category, tags } = req.body;
  const isModOrAdmin = Boolean(
    req.user?.role === 'ADMIN' ||
    req.user?.role === 'MODERATOR' ||
    req.user?.roles?.includes('ADMIN') ||
    req.user?.roles?.includes('MODERATOR')
  );
  try {
    const updated = await communityRepository.updatePost(req.params.id, req.user!.id, isModOrAdmin, {
      title,
      content,
      category,
      tags,
    });
    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Beitrag nicht gefunden.' } });
    }
    await logAudit('UPDATE_POST', `Beitrag ${req.params.id} bearbeitet`, req);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(403).json({ success: false, error: { message: err.message || 'Bearbeiten fehlgeschlagen.' } });
  }
});

apiRouter.delete('/community/posts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const isModOrAdmin = Boolean(
    req.user?.role === 'ADMIN' ||
    req.user?.role === 'MODERATOR' ||
    req.user?.roles?.includes('ADMIN') ||
    req.user?.roles?.includes('MODERATOR')
  );
  try {
    const deleted = await communityRepository.deletePost(req.params.id, req.user!.id, isModOrAdmin);
    if (!deleted) {
      return res.status(404).json({ success: false, error: { message: 'Beitrag nicht gefunden.' } });
    }
    await logAudit('DELETE_POST', `Beitrag ${req.params.id} gelöscht`, req);
    res.json({ success: true, message: 'Beitrag gelöscht' });
  } catch (err: any) {
    res.status(403).json({ success: false, error: { message: err.message || 'Löschen fehlgeschlagen.' } });
  }
});

apiRouter.post('/community/posts/:id/comments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ success: false, error: { message: 'Inhalt ist erforderlich' } });
  }

  const comment = await communityRepository.addComment(req.params.id, {
    id: `comm-${Date.now()}`,
    authorId: req.user!.id,
    authorName: req.user!.displayName,
    authorAvatar: req.user!.avatar,
    content,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ success: true, data: comment });
});

apiRouter.put('/community/posts/:postId/comments/:commentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ success: false, error: { message: 'Inhalt ist erforderlich' } });
  }
  const isModOrAdmin = Boolean(
    req.user?.role === 'ADMIN' ||
    req.user?.role === 'MODERATOR' ||
    req.user?.roles?.includes('ADMIN') ||
    req.user?.roles?.includes('MODERATOR')
  );
  try {
    const updated = await communityRepository.updateComment(req.params.postId, req.params.commentId, req.user!.id, isModOrAdmin, content);
    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Kommentar nicht gefunden.' } });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(403).json({ success: false, error: { message: err.message || 'Bearbeiten fehlgeschlagen.' } });
  }
});

apiRouter.delete(
  '/community/posts/:postId/comments/:commentId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const isModOrAdmin = Boolean(
      req.user?.role === 'ADMIN' ||
      req.user?.role === 'MODERATOR' ||
      req.user?.roles?.includes('ADMIN') ||
      req.user?.roles?.includes('MODERATOR')
    );
    try {
      const deleted = await communityRepository.deleteComment(req.params.postId, req.params.commentId, req.user!.id, isModOrAdmin);
      if (!deleted) {
        return res.status(404).json({ success: false, error: { message: 'Kommentar nicht gefunden.' } });
      }
      await logAudit('DELETE_COMMENT', `Kommentar ${req.params.commentId} gelöscht`, req);
      res.json({ success: true, message: 'Kommentar gelöscht' });
    } catch (err: any) {
      res.status(403).json({ success: false, error: { message: err.message || 'Löschen fehlgeschlagen.' } });
    }
  }
);

apiRouter.post('/community/posts/:id/like', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const likes = await communityRepository.likePost(req.params.id);
  res.json({ success: true, data: { likes } });
});

// Reporting & Moderation
apiRouter.post('/community/posts/:id/report', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Bitte gib einen Grund für die Meldung an.' } });
  }

  const report = await communityRepository.createReport({
    id: `rep-${Date.now()}`,
    reporterId: req.user!.id,
    postId: req.params.id,
    reason: String(reason).trim(),
  });

  await logAudit('COMMUNITY_POST_REPORTED', `Beitrag ${req.params.id} gemeldet von ${req.user!.username}`, req);
  res.status(201).json({ success: true, data: report, message: 'Vielen Dank. Der Beitrag wurde zur Moderation weitergeleitet.' });
});

apiRouter.post('/community/posts/:postId/comments/:commentId/report', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Bitte gib einen Grund für die Meldung an.' } });
  }

  const report = await communityRepository.createReport({
    id: `rep-${Date.now()}`,
    reporterId: req.user!.id,
    postId: req.params.postId,
    commentId: req.params.commentId,
    reason: String(reason).trim(),
  });

  await logAudit('COMMUNITY_COMMENT_REPORTED', `Kommentar ${req.params.commentId} gemeldet`, req);
  res.status(201).json({ success: true, data: report, message: 'Vielen Dank. Der Kommentar wurde zur Moderation weitergeleitet.' });
});

apiRouter.get('/admin/reports', requireRole('MODERATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.query;
  const reports = await communityRepository.getReports(status ? String(status) : undefined);
  res.json({ success: true, data: reports });
});

apiRouter.post('/admin/reports/:id/review', requireRole('MODERATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { status, reviewNotes } = req.body;
  if (!['RESOLVED', 'DISMISSED'].includes(status)) {
    return res.status(400).json({ success: false, error: { message: 'Ungültiger Status (RESOLVED oder DISMISSED erforderlich)' } });
  }

  const reviewed = await communityRepository.reviewReport(req.params.id, req.user!.id, status, reviewNotes);
  await logAudit('REPORT_REVIEWED', `Meldung ${req.params.id} als ${status} markiert`, req);
  res.json({ success: true, data: reviewed });
});


// -------------------------------------------------------------
// 7. PERSISTENT AI CONVERSATIONS & HISTORY (Sections 28, 29)
// -------------------------------------------------------------
apiRouter.get('/ai/conversations', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'usr-admin-feligor';
  const convs = await aiConversationRepository.getConversations(userId);
  res.json({ success: true, data: convs });
});

apiRouter.post('/ai/conversations', async (req: AuthenticatedRequest, res: Response) => {
  const { title, role } = req.body;
  const userId = req.user?.id || 'usr-admin-feligor';
  const conv = await aiConversationRepository.createConversation(
    userId,
    title || 'Neues Gespräch',
    role || 'general'
  );
  res.json({ success: true, data: conv });
});

apiRouter.get('/ai/conversations/:id/messages', async (req: Request, res: Response) => {
  const messages = await aiConversationRepository.getMessages(req.params.id);
  res.json({ success: true, data: messages });
});

apiRouter.post('/ai/conversations/:id/messages', async (req: Request, res: Response) => {
  const { role, content, model } = req.body;
  const message = await aiConversationRepository.addMessage(
    req.params.id,
    role || 'user',
    content || '',
    model || 'gemini-3.5-flash'
  );
  res.json({ success: true, data: message });
});

// -------------------------------------------------------------
// 8. C# / JAVA / MULTI-CLIENT API EXAMPLES (Sections 34, 35, 36)
// -------------------------------------------------------------
apiRouter.get('/tutorials', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      {
        id: 'tut-wpf-mvvm',
        title: 'C# .NET 10 WPF MVVM mit CommunityToolkit',
        category: 'Software Architecture',
        targetLanguage: 'C# 13',
        description: 'Schichtenarchitektur, Dependency Injection und ICommand.',
      },
      {
        id: 'tut-mariadb-docker',
        title: 'MariaDB 11 Containerisierung auf Ubuntu Server',
        category: 'DevOps & Database',
        targetLanguage: 'SQL / Docker',
        description: 'Volumes, User-Berechtigungen und automatisches Backup.',
      },
      {
        id: 'tut-8051-timers',
        title: '8051 Mikrocontroller Timer & SFR Berechnung',
        category: 'ITA Curriculum',
        targetLanguage: 'Assembler',
        description: 'TMOD, TH0, TL0 und Interrupt-Vektoren für 12 MHz Quarz.',
      },
    ],
  });
});

// -------------------------------------------------------------
// 9. ADMIN & INFRASTRUCTURE GOVERNANCE (Sections 11, 50, 51)
// -------------------------------------------------------------
apiRouter.get('/admin/system-health', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const dbHealth = await databaseHealthService.checkHealth();
  res.json({
    success: true,
    data: {
      status: 'ONLINE',
      platform: 'Nexus Code Play',
      database: {
        connected: dbHealth.database.connected,
        type: dbHealth.database.type,
        host: dbHealth.database.host,
        database: dbHealth.database.database,
        latencyMs: dbHealth.database.latencyMs,
        checkedAt: dbHealth.database.checkedAt,
        error: dbHealth.database.diagnosticCode,
      },
      services: {
        api: 'ONLINE',
        database: dbHealth.database.connected ? 'CONNECTED' : 'DISCONNECTED',
        ai: process.env.GEMINI_API_KEY ? 'AVAILABLE' : 'DEGRADED',
        storage: 'AVAILABLE',
      },
      infrastructure: {
        server: 'HP EliteDesk 800 G3 Mini',
        os: 'Ubuntu Server 24.04 LTS (CasaOS / Docker)',
        network: 'Tailscale Mesh-VPN',
      },
      timestamp: new Date().toISOString(),
    },
  });
});

apiRouter.get('/admin/stats', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const dbHealth = await databaseHealthService.checkHealth();
  const [allUsers, projResult, prodResult, posts, orders] = await Promise.all([
    userRepository.getAllUsers().catch(() => []),
    projectRepository.findAll({ includeDrafts: true, limit: 1000 }).catch(() => ({ projects: [], total: 0 })),
    productRepository.findAll({ includeDrafts: true, limit: 1000 }).catch(() => ({ products: [], total: 0 })),
    communityRepository.getPosts().catch(() => []),
    orderRepository.findAll().catch(() => []),
  ]);
  const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  res.json({
    success: true,
    data: {
      totalUsers: allUsers.length,
      totalProjects: projResult.projects.length,
      totalProducts: prodResult.products.length,
      totalOrders: orders.length,
      totalRevenue: Number(revenue.toFixed(2)),
      totalPosts: posts.length,
      database: {
        connected: dbHealth.database.connected,
        type: dbHealth.database.type,
        latencyMs: dbHealth.database.latencyMs,
      },
      infrastructure: {
        server: 'HP EliteDesk 800 G3 Mini',
        dockerContainers: 6,
        tailscale: 'CONNECTED',
        nginxProxyManager: 'ACTIVE',
      },
    },
  });
});

apiRouter.get('/admin/users', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const users = await userRepository.getAllUsers();
  res.json({ success: true, data: users.map((u) => authService.sanitizeUser(u)) });
});

apiRouter.patch('/admin/users/:id/role', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const newRole = req.body.role;
  if (newRole !== 'ADMIN') {
    const allUsers = await userRepository.getAllUsers();
    const activeAdmins = allUsers.filter((u) => (u.role === 'ADMIN' || u.roles?.includes('ADMIN')) && u.status === 'ACTIVE');
    if (activeAdmins.length <= 1 && activeAdmins[0]?.id === req.params.id) {
      return res.status(400).json({ success: false, error: { message: 'Der letzte aktive Administrator darf nicht herabgestuft werden.' } });
    }
  }
  const updated = await userRepository.updateRole(req.params.id, newRole);
  await logAudit('USER_ROLE_CHANGED', `Rolle von ${req.params.id} geändert auf ${newRole}`, req);
  res.json({ success: true, data: updated ? authService.sanitizeUser(updated) : null });
});

apiRouter.patch('/admin/users/:id/status', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const targetUser = await userRepository.findById(req.params.id);
  if (targetUser && (targetUser.role === 'ADMIN' || targetUser.roles?.includes('ADMIN')) && targetUser.status === 'ACTIVE') {
    const allUsers = await userRepository.getAllUsers();
    const activeAdmins = allUsers.filter((u) => (u.role === 'ADMIN' || u.roles?.includes('ADMIN')) && u.status === 'ACTIVE');
    if (activeAdmins.length <= 1 && activeAdmins[0]?.id === req.params.id) {
      return res.status(400).json({ success: false, error: { message: 'Der letzte aktive Administrator darf nicht deaktiviert werden.' } });
    }
  }
  const updated = await userRepository.toggleStatus(req.params.id);
  await logAudit('USER_STATUS_TOGGLED', `Status von ${req.params.id} umgeschaltet`, req);
  res.json({ success: true, data: updated ? authService.sanitizeUser(updated) : null });
});

apiRouter.get('/admin/audit-logs', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const logs = await auditRepository.getAuditLogs(50);
  res.json({ success: true, data: logs });
});

apiRouter.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const dbStatus = getLastDatabaseStatus();
  if (dbStatus.connected) {
    try {
      const rows = await executeQuery<any>(
        `SELECT id, user_id as userId, title, message, read_status as readStatus, notification_type as type, created_at as createdAt
         FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [req.user!.id]
      );
      return res.json({
        success: true,
        data: rows.map((r: any) => ({
          id: r.id,
          userId: r.userId,
          title: r.title,
          message: r.message,
          read: Boolean(r.readStatus),
          type: r.type,
          createdAt: r.createdAt,
        })),
      });
    } catch (err) {
      console.warn('MariaDB notifications fetch failed:', err);
    }
  }
  res.json({ success: true, data: [] });
});

apiRouter.post('/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const dbStatus = getLastDatabaseStatus();
  if (dbStatus.connected) {
    try {
      await executeQuery(`UPDATE notifications SET read_status = 1 WHERE user_id = ?`, [req.user!.id]);
    } catch (err) {
      console.warn('MariaDB notifications read-all failed:', err);
    }
  }
  res.json({ success: true });
});

// -------------------------------------------------------------
// 10. PRESERVED GEMINI AI ENDPOINTS (Workspace Engine)
// -------------------------------------------------------------
const SYSTEM_INSTRUCTIONS: Record<string, string> = {
  general: `Du bist der persönliche, technisch anspruchsvolle KI-Assistent für Nexus Code Play.
Dein Entwickler ist ein Auszubildender zum Informationstechnischen Assistenten (ITA) im 2. Ausbildungsjahr, der 2027 die Fachhochschulreife anstrebt und ein duales Studium der Wirtschaftsinformatik bei der Atruvia AG plant.
Sein Tech-Stack umfasst:
- Softwareentwicklung: C#, WPF, .NET 10.0, Java, REST-APIs, Hibernate, PokeAPI, SQL, MS Access, Python, C++, HTML/CSS/JS, 8051 Assembler
- Game-Server & Modding: Minecraft (Fabric), Roblox (Lua/Luau)
- Home-Server / DevOps: HP EliteDesk 800 G3 Mini, Ubuntu Server, CasaOS, Docker, Nginx Proxy Manager, Tailscale, MariaDB
- KI & Automatisierung: Ollama, Llama 3.2, n8n
- Daten: CouchDB, Obsidian LiveSync
- Hardware / Maker: Bambu Lab P1S Combo, PLA, PETG, Tinkercad, Gridfinity, Bento3D

Wichtige Prinzipien:
1. Korrektheit vor Geschwindigkeit.
2. Keine vereinfachten Schullösungen oder Dummy-Code, sondern echte industrielle Best Practices (z.B. MVVM in C#, SOLID, saubere Container-Isolation, Least Privilege).
3. Behandle Projekte als langlebige Systeme.
4. Erkläre technische Zusammenhänge präzise, verständlich und nachvollziehbar.`,

  architect: `Du bist der Senior Software Architect und Full-Stack Lead Engineer für Nexus Code Play.
Du bist Experte für C# (.NET 10), WPF mit MVVM, saubere Dependency Injection, Java mit Spring/Hibernate, REST-APIs, Datenbankdesign (MariaDB, PostgreSQL, SQL), Python und moderne C++-Praktiken (RAII, Ownership).
Vermeide Business-Logik im Code-Behind von WPF-Views. Nutze ICommand/RelayCommand, saubere Bindings und Repositories.
Liefere produktionsreifen, erweiterbaren Code.`,

  devops: `Du bist der Senior DevOps & System Administrator für die Home-Server- und Netzwerk-Infrastruktur.
Spezialisiert auf:
- HP EliteDesk 800 G3 Mini PC
- Ubuntu Server 24.04 LTS / CasaOS
- Docker & Docker Compose (Container-Isolation, benannte Volumes, Sicherheitsrichtlinien, Restart Policies)
- Nginx Proxy Manager (TLS/SSL, Websockets, Proxy Hosts)
- Tailscale (sichere Mesh-VPN-Verbindungen ohne unnötige Portfreigaben)
- MariaDB Konfiguration und Backups
Sicherheit und Least Privilege haben höchste Priorität. Vermeide unnötig offene Ports.`,

  gameserver: `Du bist der Game-Server- und Modding-Architekt für Minecraft und Roblox.
- Minecraft: Fabric Modding, Fabric API, Trennung von Client- und Server-Code, Log-Analyse, Stacktrace-Debugging, Mod-Kompatibilität.
- Roblox: Luau / Lua-Skripte. Strikte Trennung von ClientScript und ServerScript über RemoteEvents / RemoteFunctions. Niemals Client-Daten ungeprüft vertrauen; sicherheitskritische Spiellogik liegt immer serverseitig.`,

  ita_coach: `Du bist der technische Prüfungs- und Karriere-Coach für das 2. ITA-Ausbildungsjahr, die Fachhochschulreife 2027 und das angestrebte duale Studium der Wirtschaftsinformatik bei der Atruvia AG.
Du kennst dich exzellent mit dem ITA-Lehrplan aus:
- 8051 Mikrocontroller & Assembler (Register, Adressierungsarten, Timer, Interrupts, Ports)
- Datenbanktheorie: Normalisierung (1NF, 2NF, 3NF), ER-Modellierung, SQL, MS Access Formular- & Tabellenkonventionen
- Wirtschaftsinformatik-Grundlagen (Geschäftsprozesse, IT-Infrastruktur im Genossenschaftsbanken-Umfeld der Atruvia AG)
- Objektorientierte Programmierung in Java und C#
Erkläre didaktisch fundiert und anspruchsvoll, damit der Schüler Top-Noten erzielt und optimal auf Auswahlverfahren vorbereitet ist.`,

  maker: `Du bist der 3D-Druck- und Hardware-Experte für Bambu Lab P1S Combo, PLA, PETG, Tinkercad, Gridfinity und Bento3D.
Du analysierst Slicer-Profile (Bambu Studio / OrcaSlicer), Flow Rate, Layerhaftung, Druckbetttemperatur, Bauraumbelüftung (Bento3D Aktivkohlefilter) und funktionale Konstruktion für Werkstatt- und Home-Server-Zubehör.`,
};

async function safeGenerate(options: {
  contents: any;
  systemInstruction?: string;
  temperature?: number;
  fallbackText?: string;
}): Promise<string> {
  const modelsToTry = ['gemini-flash-latest', 'gemini-3.1-flash-lite'];
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.5,
        },
      });
      if (response.text) return response.text;
    } catch (err: any) {
      console.warn(`AI model ${model} failed, trying next:`, err?.message || err);
    }
  }
  return (
    options.fallbackText ||
    'Hinweis: Die KI-Schnittstelle hat derzeit das API-Kontingent erreicht (Rate Limit / Quota). Bitte versuche es in wenigen Minuten erneut oder prüfe die API-Schlüssel-Konfiguration.'
  );
}

apiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, role = 'general' } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const systemInstruction = SYSTEM_INSTRUCTIONS[role] || SYSTEM_INSTRUCTIONS.general;

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const reply = await safeGenerate({
      contents,
      systemInstruction,
      temperature: 0.7,
    });

    return res.json({ reply });
  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    return res.json({
      reply: 'Der KI-Assistent ist vorübergehend ausgelastet. Bitte versuche es in Kürze erneut.',
    });
  }
});

apiRouter.post('/analyze-code', async (req: Request, res: Response) => {
  try {
    const { code, language, errorLog, context } = req.body;

    if (!code && !errorLog) {
      return res.status(400).json({ error: 'Code or error log must be provided' });
    }

    const prompt = `Du bist der technische Lead Debugger von Nexus Code Play.
Analysiere folgenden Code bzw. Fehlerbericht strikt nach der folgenden 5-stufigen Debugging-Methodik:

1. FEHLERBILD IDENTIFIZIEREN (Was genau passiert oder schlägt fehl?)
2. URSACHENANALYSE & FEHLERMELDUNG (Genaue Erklärung des Stacktraces, der Log-Meldung oder des semantischen Fehlers)
3. RELEVANTE KOMPONENTEN (Welche Schichten, Module, Bindings, Ports oder Bibliotheken sind betroffen?)
4. KONKRETE LÖSUNG & VOLLSTÄNDIGER KORRIGIERTER CODE (Sauberer, produktionsreifer, refaktorisierter Code nach Best Practices wie MVVM/SOLID/Container-Isolation)
5. TESTSCHRITTE (Konkrete Schritte zur Verifikation)

SPRACHE / TECHNOLOGIE: ${language || 'Auto-detect'}
KONTEXT: ${context || 'ITA-Projekt / Home Server'}

FEHLERPROTOKOLL / LOGS / STACKTRACE:
\`\`\`
${errorLog || 'Keine expliziten Fehlermeldungen, führe statische Code-Analyse und Security-Audit durch.'}
\`\`\`

CODE:
\`\`\`${language || ''}
${code || ''}
\`\`\`

Antworte strukturiert in sauberem Markdown mit klaren Überschriften.`;

    const analysis = await safeGenerate({
      contents: prompt,
      temperature: 0.3,
      fallbackText: 'Code-Analyse vorübergehend nicht verfügbar: Das KI-Anfragelimit wurde erreicht.',
    });

    return res.json({ analysis });
  } catch (error: any) {
    console.error('Code analysis error:', error);
    return res.json({
      analysis: 'Die Code-Analyse ist momentan wegen API-Auslastung nicht verfügbar. Bitte in Kürze erneut anfordern.',
    });
  }
});

apiRouter.post('/generate-docs', async (req: Request, res: Response) => {
  try {
    const { title, docType, requirements, techStack } = req.body;

    const prompt = `Erstelle eine hochwertige, industrietaugliche technische Dokumentation oder Spezifikation für folgendes Projekt im Rahmen der ITA-Ausbildung und Nexus Code Play:

TITEL: ${title}
DOKUMENTATIONS-TYP: ${docType}
TECHNOLOGIE-STACK: ${techStack}
ANFORDERUNGEN & DETAILS:
${requirements}

Erstelle:
1. Executive Summary & Zielsetzung
2. Architektur & Systemübersicht (inklusive Diagramme in ASCII oder Mermaid)
3. Konkrete Implementierungsdetails / Konfigurationen (z.B. vollständige docker-compose.yml, C# Interfaces, SQL DDL Statements)
4. Sicherheits- & Netzwerk-Aspekte (z.B. Portfreigaben, Least Privilege, Secrets Management)
5. Wartungs- & Backup-Strategie

Verwende präzise Fachbegriffe und vollständigen, einsatzbereiten Code ohne Platzhalter.`;

    const documentation = await safeGenerate({
      contents: prompt,
      temperature: 0.4,
      fallbackText: 'Dokumentations-Generator vorübergehend ausgelastet.',
    });

    return res.json({ documentation });
  } catch (error: any) {
    console.error('Doc generator error:', error);
    return res.json({ documentation: 'Dokumentation konnte aufgrund eines Quota-Limits nicht generiert werden.' });
  }
});

apiRouter.post('/quick-action', async (req: Request, res: Response) => {
  try {
    const { actionType, input } = req.body;

    let instruction = '';
    switch (actionType) {
      case 'docker_snippet':
        instruction = 'Generiere ein sauberes, sicheres Docker-Compose-Snippet mit benannten Volumes, non-root User, Restart-Policy und internem Netzwerk für: ' + input;
        break;
      case 'wpf_command':
        instruction = 'Erstelle ein modernes C# .NET 10 MVVM RelayCommand / ICommand Pattern mit Binding-Code für: ' + input;
        break;
      case 'sql_optimize':
        instruction = 'Optimiere diese SQL-Abfrage für MariaDB/MySQL, erkläre Indizes und vermeide Table Scans: ' + input;
        break;
      case 'asm_8051':
        instruction = 'Schreibe eine kommentierte 8051 Assembler-Routine für folgende Aufgabe, erkläre Register (ACC, B, DPTR, R0-R7) und Timer/Interrupts: ' + input;
        break;
      case 'nginx_proxy':
        instruction = 'Erstelle eine Nginx Proxy Manager Konfiguration inklusive WebSocket-Support, SSL/TLS Header und HSTS für: ' + input;
        break;
      default:
        instruction = 'Beantworte kurz und präzise die technische Frage: ' + input;
    }

    const result = await safeGenerate({
      contents: instruction,
      temperature: 0.2,
      fallbackText: 'Quick Action derzeit nicht verfügbar.',
    });

    return res.json({ result });
  } catch (error: any) {
    console.error('Quick action error:', error);
    return res.json({ result: 'Quick Action konnte wegen Kontingentüberziehung nicht ausgeführt werden.' });
  }
});

// Centralized API Error Handling Middleware
apiRouter.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
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
    code === 'ER_BAD_DB_ERROR';

  if (isDatabaseError) {
    console.warn(`[Database API] 503 Service Unavailable (${req.method} ${req.originalUrl || req.path}): ${message}`);
    return res.status(503).json({
      success: false,
      error: { message: message || 'MariaDB ist nicht erreichbar. Die Anfrage wurde nicht gespeichert.', code: 'DATABASE_UNAVAILABLE' },
    });
  }

  console.error(`[API Error] (${req.method} ${req.originalUrl || req.path}):`, error);
  return res.status(500).json({ success: false, error: { message: message || 'Interner Serverfehler.' } });
});

