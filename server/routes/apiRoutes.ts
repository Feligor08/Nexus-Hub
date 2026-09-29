import { Router, Request, Response, NextFunction } from 'express';
import { GoogleGenAI } from '@google/genai';
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
import { runMigrations } from '../migrations/migrator';
import { authenticate, requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { User, Order, ProductVersion, Project, Product } from '../models/types';
import { getLastDatabaseStatus, withTransaction } from '../config/database';
import { mediaStorage, getUploadCategory } from '../services/mediaStorage';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2';
import path from 'path';
import { executeQuery } from '../config/database';

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

const isProd = process.env.NODE_ENV === 'production';

const setSessionCookie = (res: Response, token: string) => {
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', `nexus_session=${token}; ${flags}`);
};

const clearSessionCookie = (res: Response) => {
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', `nexus_session=; ${flags}`);
};

const logAudit = async (action: string, details: string, req: AuthenticatedRequest) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userId = req.user?.id || 'unauthenticated';
  const username = req.user?.username || 'anonymous';
  await auditRepository.log(action, userId, username, details, ip);
};

const isAdmin = (user?: User) => Boolean(user && (user.role === 'ADMIN' || user.roles?.includes('ADMIN')));

const validUrl = (value: unknown, allowLocalPath = false): boolean => {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' || value.length > 1000) return false;
  if (allowLocalPath && value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const validateProjectPayload = (body: unknown): { data?: Partial<Project>; error?: string } => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Ungültige Projektdaten.' };
  }

  const input = body as Partial<Project>;
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200) {
    return { error: 'Der Titel muss zwischen 1 und 200 Zeichen lang sein.' };
  }
  if (typeof input.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 100) {
    return { error: 'Der Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.' };
  }
  if (typeof input.shortDesc !== 'string' || !input.shortDesc.trim() || input.shortDesc.length > 500) {
    return { error: 'Die Kurzbeschreibung muss zwischen 1 und 500 Zeichen lang sein.' };
  }
  if (typeof input.description !== 'string' || !input.description.trim() || input.description.length > 50000) {
    return { error: 'Die Beschreibung muss zwischen 1 und 50000 Zeichen lang sein.' };
  }
  if (input.status !== undefined && !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(input.status)) {
    return { error: 'Ungültiger Projektstatus.' };
  }
  if (input.visibility !== undefined && !['PUBLIC', 'PRIVATE'].includes(input.visibility)) {
    return { error: 'Ungültige Sichtbarkeit.' };
  }
  if (input.techStack !== undefined && (!Array.isArray(input.techStack) || input.techStack.length > 50 || input.techStack.some((item) => typeof item !== 'string' || !item.trim() || item.length > 100))) {
    return { error: 'Die Technologieliste ist ungültig.' };
  }
  if (input.galleryMediaIds !== undefined && (!Array.isArray(input.galleryMediaIds) || input.galleryMediaIds.length > 20 || input.galleryMediaIds.some((id) => typeof id !== 'string' || id.length > 64))) {
    return { error: 'Die Projektgalerie enthält ungültige Medien-IDs.' };
  }
  if (![input.githubUrl, input.liveUrl, input.demoUrl, input.documentationUrl, input.videoUrl].every((url) => validUrl(url))) {
    return { error: 'Projektlinks müssen gültige HTTP- oder HTTPS-URLs sein.' };
  }
  if (input.coverMediaId !== undefined && (typeof input.coverMediaId !== 'string' || input.coverMediaId.length > 64)) {
    return { error: 'Die Cover-Medien-ID ist ungültig.' };
  }

  return {
    data: {
      title: input.title.trim(),
      slug: input.slug,
      shortDesc: input.shortDesc.trim(),
      description: input.description.trim(),
      category: input.category,
      status: input.status,
      visibility: input.visibility,
      featured: input.featured,
      techStack: input.techStack,
      problem: input.problem,
      solution: input.solution,
      goal: input.goal,
      result: input.result,
      caseStudyProblem: input.caseStudyProblem,
      caseStudySolution: input.caseStudySolution,
      caseStudyLearnings: input.caseStudyLearnings,
      architecture: input.architecture,
      githubUrl: input.githubUrl,
      liveUrl: input.liveUrl,
      demoUrl: input.demoUrl,
      documentationUrl: input.documentationUrl,
      videoUrl: input.videoUrl,
      coverMediaId: input.coverMediaId,
      galleryMediaIds: input.galleryMediaIds,
    },
  };
};

const validateProductPayload = (body: unknown): { data?: Partial<Product>; error?: string } => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Ungültige Produktdaten.' };
  }

  const input = body as Partial<Product>;
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 200) {
    return { error: 'Der Produktname muss zwischen 1 und 200 Zeichen lang sein.' };
  }
  if (typeof input.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 100) {
    return { error: 'Der Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.' };
  }
  if (typeof input.shortDesc !== 'string' || !input.shortDesc.trim() || input.shortDesc.length > 500) {
    return { error: 'Die Kurzbeschreibung muss zwischen 1 und 500 Zeichen lang sein.' };
  }
  if (typeof input.description !== 'string' || !input.description.trim() || input.description.length > 50000) {
    return { error: 'Die Beschreibung muss zwischen 1 und 50000 Zeichen lang sein.' };
  }
  if (typeof input.category !== 'string' || !input.category.trim() || input.category.length > 50) {
    return { error: 'Eine gültige Produktkategorie ist erforderlich.' };
  }
  if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price < 0 || input.price > 99999999.99) {
    return { error: 'Der Produktpreis ist ungültig.' };
  }
  if (typeof input.currency !== 'string' || !/^[A-Z]{3}$/.test(input.currency)) {
    return { error: 'Die Währung muss ein gültiger ISO-Code sein.' };
  }
  if (input.status !== undefined && !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(input.status)) {
    return { error: 'Ungültiger Produktstatus.' };
  }
  if (input.visibility !== undefined && !['PUBLIC', 'PRIVATE'].includes(input.visibility)) {
    return { error: 'Ungültige Sichtbarkeit.' };
  }
  const validTextArray = (items: unknown, maxItems: number, maxLength: number) =>
    items === undefined || (Array.isArray(items) && items.length <= maxItems && items.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= maxLength));
  if (!validTextArray(input.tags, 30, 50) || !validTextArray(input.features, 50, 500) || !validTextArray(input.requirements, 50, 500)) {
    return { error: 'Tags, Features oder Requirements enthalten ungültige Werte.' };
  }
  if (typeof input.version !== 'string' || !input.version.trim() || input.version.length > 30) {
    return { error: 'Die Version muss zwischen 1 und 30 Zeichen lang sein.' };
  }
  if (input.changelog !== undefined && (typeof input.changelog !== 'string' || input.changelog.length > 50000)) {
    return { error: 'Der Changelog ist zu lang.' };
  }
  if (input.metaTitle !== undefined && (typeof input.metaTitle !== 'string' || input.metaTitle.length > 255)) {
    return { error: 'Der SEO-Titel ist zu lang.' };
  }
  if (input.metaDescription !== undefined && (typeof input.metaDescription !== 'string' || input.metaDescription.length > 500)) {
    return { error: 'Die SEO-Beschreibung ist zu lang.' };
  }
  if (input.galleryMediaIds !== undefined && (!Array.isArray(input.galleryMediaIds) || input.galleryMediaIds.length > 20 || input.galleryMediaIds.some((id) => typeof id !== 'string' || id.length > 64))) {
    return { error: 'Die Produktgalerie enthält ungültige Medien-IDs.' };
  }
  if (![input.demoFileUrl, input.documentationUrl].every((url) => validUrl(url))) {
    return { error: 'Produktlinks müssen gültige HTTP- oder HTTPS-URLs sein.' };
  }

  return {
    data: {
      name: input.name.trim(), slug: input.slug, shortDesc: input.shortDesc.trim(),
      description: input.description.trim(), category: input.category, price: input.price,
      currency: input.currency, version: input.version, status: input.status,
      visibility: input.visibility, featured: input.featured,
      digitalProduct: input.digitalProduct, fileFormat: input.fileFormat, fileSize: input.fileSize,
      license: input.license, tags: input.tags, features: input.features,
      requirements: input.requirements, changelog: input.changelog,
      metaTitle: input.metaTitle, metaDescription: input.metaDescription,
      coverMediaId: input.coverMediaId, galleryMediaIds: input.galleryMediaIds,
      downloadMediaId: input.downloadMediaId, demoFileUrl: input.demoFileUrl,
      documentationUrl: input.documentationUrl,
    },
  };
};

const sendProductWriteError = (res: Response, error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  console.error('Product CMS write failed:', error);
  if (!getLastDatabaseStatus().connected) {
    return res.status(503).json({ success: false, error: { message: 'MariaDB ist nicht erreichbar. Das Produkt wurde nicht gespeichert.' } });
  }
  if (code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, error: { message: 'Dieser Produkt-Slug ist bereits vergeben.' } });
  }
  if (error instanceof Error && error.message.startsWith('Mediendatei')) {
    return res.status(403).json({ success: false, error: { message: error.message } });
  }
  return res.status(500).json({ success: false, error: { message: 'Das Produkt konnte nicht gespeichert werden.' } });
};

const sendProjectWriteError = (res: Response, error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';
  console.error('Project CMS write failed:', error);

  if (!getLastDatabaseStatus().connected) {
    return res.status(503).json({ success: false, error: { message: 'MariaDB ist nicht erreichbar. Das Projekt wurde nicht gespeichert.' } });
  }
  if (code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, error: { message: 'Dieser Projekt-Slug ist bereits vergeben.' } });
  }
  return res.status(500).json({ success: false, error: { message: 'Das Projekt konnte nicht gespeichert werden.' } });
};

const requireProjectDatabase = (res: Response): boolean => {
  if (getLastDatabaseStatus().connected) return true;
  res.status(503).json({
    success: false,
    error: { message: 'MariaDB ist nicht erreichbar. Projektänderungen sind derzeit nicht möglich.' },
  });
  return false;
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
        error: result.database.error || 'Connection refused or host unreachable',
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

// Session Check Endpoint
apiRouter.get('/auth/me', (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    res.json({
      success: true,
      authenticated: true,
      user: req.user,
      data: req.user,
    });
  } else {
    res.json({
      success: true,
      authenticated: false,
      user: null,
      data: null,
    });
  }
});

// User Registration
apiRouter.post('/auth/register', async (req: AuthenticatedRequest, res: Response) => {
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
apiRouter.post('/auth/login', async (req: AuthenticatedRequest, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  const result = await authService.login(req.body, ip, userAgent);
  if (!result.success || !result.user || !result.token) {
    await auditRepository.log(
      'AUTH_FAILED',
      'anonymous',
      req.body.email || 'unknown',
      `Fehlgeschlagener Anmeldeversuch für ${req.body.email}`,
      ip
    );
    return res.status(401).json({
      success: false,
      authenticated: false,
      error: { message: result.error || 'Ungültige Anmeldedaten' },
    });
  }

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

apiRouter.post('/auth/switch-role', (_req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: { message: 'Rollen können nicht per API gewechselt werden. Admins verwalten Rollen serverseitig.' },
  });
});

// Update Profile
apiRouter.put('/users/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { displayName, bio, avatar, skills, technologies, githubUrl, websiteUrl } = req.body;

  const updated = await userRepository.updateProfile(userId, {
    displayName,
    bio,
    avatar,
    skills,
    technologies,
    githubUrl,
    websiteUrl,
  });

  await logAudit('UPDATE_PROFILE', 'Benutzerprofil aktualisiert', req);
  res.json({
    success: true,
    user: updated,
    data: updated,
    message: 'Profil erfolgreich gespeichert',
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
  const { category, search, page, limit } = req.query;
  const result = await projectRepository.findAll({
    category: category ? String(category) : undefined,
    search: search ? String(search) : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ success: true, data: result.projects, total: result.total });
});

apiRouter.get('/projects/featured', async (req: Request, res: Response) => {
  const result = await projectRepository.findAll({ featured: true, limit: 6 });
  res.json({ success: true, data: result.projects });
});

apiRouter.get('/projects/:slug', async (req: Request, res: Response) => {
  const project = await projectRepository.findBySlug(req.params.slug);
  if (!project || project.status !== 'PUBLISHED' || project.visibility !== 'PUBLIC') {
    return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
  }
  res.json({ success: true, data: project });
});

apiRouter.post('/projects', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const validation = validateProjectPayload(req.body);
  if (!validation.data) {
    return res.status(400).json({ success: false, error: { message: validation.error } });
  }

  try {
    const adminAccess = isAdmin(req.user);
    const created = await projectRepository.create({
      ...validation.data,
      status: validation.data.status || 'DRAFT',
      authorId: req.user!.id,
    }, adminAccess);
    await logAudit('CREATE_PROJECT', `Projekt erstellt: ${created.title}`, req);
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return sendProjectWriteError(res, error);
  }
});

apiRouter.put('/projects/:id', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireProjectDatabase(res)) return;
  const existing = await projectRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
  }
  const adminAccess = isAdmin(req.user);
  if (!adminAccess && existing.authorId !== req.user!.id) {
    return res.status(403).json({ success: false, error: { message: 'Du darfst dieses Projekt nicht bearbeiten.' } });
  }

  const validation = validateProjectPayload(req.body);
  if (!validation.data) {
    return res.status(400).json({ success: false, error: { message: validation.error } });
  }

  try {
    const updated = await projectRepository.update(
      req.params.id,
      validation.data,
      adminAccess ? undefined : req.user!.id,
      adminAccess
    );
    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
    }
    await logAudit('UPDATE_PROJECT', `Projekt aktualisiert: ${updated.title}`, req);
    return res.json({ success: true, data: updated });
  } catch (error) {
    return sendProjectWriteError(res, error);
  }
});

apiRouter.patch('/projects/:id/status', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireProjectDatabase(res)) return;
  const { status } = req.body;
  if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
    return res.status(400).json({ success: false, error: { message: 'Ungültiger Status' } });
  }
  const existing = await projectRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
  }
  const adminAccess = isAdmin(req.user);
  if (!adminAccess && existing.authorId !== req.user!.id) {
    return res.status(403).json({ success: false, error: { message: 'Du darfst dieses Projekt nicht ändern.' } });
  }

  try {
    const updated = await projectRepository.update(
      req.params.id,
      { status },
      adminAccess ? undefined : req.user!.id,
      adminAccess
    );
    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
    }
    await logAudit('PROJECT_STATUS_CHANGED', `Projekt-Status: ${updated.title} -> ${status}`, req);
    return res.json({ success: true, data: updated });
  } catch (error) {
    return sendProjectWriteError(res, error);
  }
});

apiRouter.delete('/projects/:id', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireProjectDatabase(res)) return;
  const existing = await projectRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
  }
  const adminAccess = isAdmin(req.user);
  if (!adminAccess && existing.authorId !== req.user!.id) {
    return res.status(403).json({ success: false, error: { message: 'Du darfst dieses Projekt nicht löschen.' } });
  }

  try {
    const success = await projectRepository.delete(
      req.params.id,
      adminAccess ? undefined : req.user!.id
    );
    if (!success) {
      return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
    }
    await logAudit('DELETE_PROJECT', `Projekt gelöscht: ${req.params.id}`, req);
    return res.json({ success: true, message: 'Projekt erfolgreich gelöscht' });
  } catch (error) {
    return sendProjectWriteError(res, error);
  }
});

// -------------------------------------------------------------
// 4. PRODUCTS & STORE (Sections 21, 22, 23)
// -------------------------------------------------------------
apiRouter.get('/products', async (req: Request, res: Response) => {
  const { category, search, page, limit, status, includeDrafts } = req.query;
  const user = req as AuthenticatedRequest;
  const privileged = Boolean(user.user && (
    user.user.role === 'ADMIN' || user.user.role === 'CREATOR' ||
    user.user.roles?.includes('ADMIN') || user.user.roles?.includes('CREATOR')
  ));
  const cmsQuery = includeDrafts === 'true' || status !== undefined;
  if (cmsQuery && !privileged) {
    return res.status(user.user ? 403 : 401).json({ success: false, error: { message: 'Creator- oder Administrator-Rolle erforderlich.' } });
  }

  try {
    const result = await productRepository.findAll({
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
      status: cmsQuery && status ? String(status) : 'PUBLISHED',
      visibility: cmsQuery ? undefined : 'PUBLIC',
      authorId: cmsQuery && user.user && !isAdmin(user.user) ? user.user.id : undefined,
      includeDrafts: cmsQuery,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return res.json({ success: true, data: result.products, total: result.total });
  } catch (error) {
    console.error('Product list query failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Produkte konnten nicht aus MariaDB geladen werden.' } });
  }
});

apiRouter.get('/products/featured', async (req: Request, res: Response) => {
  try {
    const result = await productRepository.findAll({ featured: true, status: 'PUBLISHED', visibility: 'PUBLIC', limit: 6 });
    return res.json({ success: true, data: result.products });
  } catch (error) {
    console.error('Featured product query failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Produkte konnten nicht aus MariaDB geladen werden.' } });
  }
});

apiRouter.get('/products/:slug', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const product = await productRepository.findBySlug(req.params.slug);
    if (!product) {
      return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden' } });
    }
    const publicProduct = product.status === 'PUBLISHED' && product.visibility === 'PUBLIC';
    const adminAccess = isAdmin(req.user);
    if (!publicProduct && !adminAccess && product.authorId !== req.user?.id) {
      return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden' } });
    }
    return res.json({ success: true, data: product });
  } catch (error) {
    console.error('Product detail query failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Produkt konnte nicht aus MariaDB geladen werden.' } });
  }
});

apiRouter.post('/products', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const validation = validateProductPayload(req.body);
  if (!validation.data) {
    return res.status(400).json({ success: false, error: { message: validation.error } });
  }
  try {
    const adminAccess = isAdmin(req.user);
    const created = await productRepository.create({
      ...validation.data,
      status: validation.data.status || 'DRAFT',
      authorId: req.user!.id,
    }, adminAccess);
    await logAudit('CREATE_PRODUCT', `Produkt erstellt: ${created.name}`, req);
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return sendProductWriteError(res, error);
  }
});

apiRouter.put('/products/:id', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  if (!getLastDatabaseStatus().connected) {
    return res.status(503).json({ success: false, error: { message: 'MariaDB ist nicht erreichbar. Produktänderungen sind derzeit nicht möglich.' } });
  }
  const existing = await productRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden' } });
  }
  const adminAccess = isAdmin(req.user);
  if (!adminAccess && existing.authorId !== req.user!.id) {
    return res.status(403).json({ success: false, error: { message: 'Du darfst dieses Produkt nicht bearbeiten.' } });
  }
  const validation = validateProductPayload(req.body);
  if (!validation.data) {
    return res.status(400).json({ success: false, error: { message: validation.error } });
  }
  try {
    const updated = await productRepository.update(req.params.id, validation.data, adminAccess ? undefined : req.user!.id, adminAccess);
    if (!updated) return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden.' } });
    await logAudit('UPDATE_PRODUCT', `Produkt aktualisiert: ${updated.name}`, req);
    return res.json({ success: true, data: updated });
  } catch (error) {
    return sendProductWriteError(res, error);
  }
});

apiRouter.patch('/products/:id/status', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
    return res.status(400).json({ success: false, error: { message: 'Ungültiger Status' } });
  }
  if (!getLastDatabaseStatus().connected) {
    return res.status(503).json({ success: false, error: { message: 'MariaDB ist nicht erreichbar. Produktstatus konnte nicht geändert werden.' } });
  }
  const existing = await productRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden.' } });
  const adminAccess = isAdmin(req.user);
  if (!adminAccess && existing.authorId !== req.user!.id) {
    return res.status(403).json({ success: false, error: { message: 'Du darfst dieses Produkt nicht veröffentlichen oder archivieren.' } });
  }
  try {
    const updated = await productRepository.update(req.params.id, { status }, adminAccess ? undefined : req.user!.id, adminAccess);
    if (!updated) return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden.' } });
    await logAudit('PRODUCT_STATUS_CHANGED', `Produkt-Status: ${updated.name} -> ${status}`, req);
    return res.json({ success: true, data: updated });
  } catch (error) {
    return sendProductWriteError(res, error);
  }
});

apiRouter.delete('/products/:id', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  if (!getLastDatabaseStatus().connected) {
    return res.status(503).json({ success: false, error: { message: 'MariaDB ist nicht erreichbar. Produkt kann nicht gelöscht werden.' } });
  }
  const existing = await productRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden.' } });
  const adminAccess = isAdmin(req.user);
  if (!adminAccess && existing.authorId !== req.user!.id) {
    return res.status(403).json({ success: false, error: { message: 'Du darfst dieses Produkt nicht löschen.' } });
  }
  try {
    const success = await productRepository.delete(req.params.id, adminAccess ? undefined : req.user!.id);
    if (!success) return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden.' } });
    await logAudit('DELETE_PRODUCT', `Produkt gelöscht: ${req.params.id}`, req);
    return res.json({ success: true, message: 'Produkt gelöscht' });
  } catch (error) {
    return sendProductWriteError(res, error);
  }
});

// Claim free product (Price === 0)
apiRouter.post('/products/:id/claim-free', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const product = await productRepository.findById(req.params.id);
  if (!product || product.status !== 'PUBLISHED' || product.visibility !== 'PUBLIC') {
    return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden' } });
  }
  if (product.price > 0) {
    return res.status(400).json({ success: false, error: { message: 'Dieses Produkt ist nicht kostenlos' } });
  }
  if (!product.downloadMediaId) {
    return res.status(409).json({ success: false, error: { message: 'Für dieses Produkt ist keine Download-Datei hinterlegt.' } });
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
    paymentStatus: 'NOT_REQUIRED',
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
  try {
    const product = await productRepository.findById(req.params.id);
    if (!product || product.status !== 'PUBLISHED' || product.visibility !== 'PUBLIC') {
      return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden.' } });
    }
    const versions = await executeQuery<any>(
      `SELECT id, product_id AS productId, version, release_notes AS releaseNotes, media_id AS mediaId, created_at AS createdAt
       FROM product_versions WHERE product_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    return res.json({ success: true, data: versions });
  } catch (error) {
    console.error('Product versions query failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Versionen konnten nicht geladen werden.' } });
  }
});

apiRouter.post('/products/:id/versions', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { version, releaseNotes, mediaId } = req.body;
  if (typeof version !== 'string' || !/^[0-9A-Za-z.+-]{1,50}$/.test(version) || (releaseNotes !== undefined && (typeof releaseNotes !== 'string' || releaseNotes.length > 10000))) {
    return res.status(400).json({ success: false, error: { message: 'Versionsnummer erforderlich' } });
  }
  const product = await productRepository.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden.' } });
  const adminAccess = isAdmin(req.user);
  if (!adminAccess && product.authorId !== req.user!.id) {
    return res.status(403).json({ success: false, error: { message: 'Du darfst dieses Produkt nicht ändern.' } });
  }
  if (mediaId) {
    const media = await mediaRepository.findById(mediaId);
    if (!media || (!adminAccess && media.ownerId !== req.user!.id) || media.fileCategory === 'image') {
      return res.status(403).json({ success: false, error: { message: 'Download-Datei nicht gefunden oder nicht im eigenen Besitz.' } });
    }
  }
  const id = `ver-${randomUUID()}`;
  const newVer: ProductVersion = {
    id,
    productId: req.params.id,
    version,
    releaseNotes: releaseNotes || '',
    mediaId,
    createdAt: new Date().toISOString(),
  };
  try {
    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO product_versions (id, product_id, version, release_notes, media_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
        [id, req.params.id, version, releaseNotes || '', mediaId || null]
      );
      await connection.execute(`UPDATE products SET version = ?, updated_at = NOW() WHERE id = ?`, [version, req.params.id]);
    });
    await logAudit('CREATE_PRODUCT_VERSION', `Version ${version} für Produkt ${req.params.id} veröffentlicht`, req);
    return res.status(201).json({ success: true, data: newVer });
  } catch (error) {
    return sendProductWriteError(res, error);
  }
});

// -------------------------------------------------------------
// 5. CARTS & ORDERS (Sections 24, 25, 26, 41)
// -------------------------------------------------------------
const ensureUserCart = async (connection: import('mysql2/promise').PoolConnection, userId: string): Promise<string> => {
  await connection.execute(`SELECT id FROM users WHERE id = ? FOR UPDATE`, [userId]);
  const [rows] = await connection.execute<Array<import('mysql2').RowDataPacket & { id: string }>>(
    `SELECT id FROM carts WHERE user_id = ? ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
    [userId]
  );
  if (rows.length > 0) return rows[0].id;
  const id = `cart-${randomUUID()}`;
  await connection.execute(`INSERT INTO carts (id, user_id) VALUES (?, ?)`, [id, userId]);
  return id;
};

const loadCart = async (userId: string) => {
  const rows = await executeQuery<RowDataPacket & {
    productId: string;
    quantity: number;
    name: string;
    price: number;
    currency: string;
    fileFormat: string;
  }>(
    `SELECT ci.product_id AS productId, ci.quantity, p.name, p.price, p.currency, p.file_format AS fileFormat
     FROM carts c
     JOIN cart_items ci ON ci.cart_id = c.id
     JOIN products p ON p.id = ci.product_id
     WHERE c.user_id = ? AND p.status = 'PUBLISHED' AND p.visibility = 'PUBLIC'
     ORDER BY ci.created_at ASC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.productId,
    productId: row.productId,
    quantity: Number(row.quantity),
    name: row.name,
    price: Number(row.price),
    currency: row.currency,
    fileFormat: row.fileFormat,
  }));
};

apiRouter.get('/cart', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!getLastDatabaseStatus().connected) throw new Error('DATABASE_UNAVAILABLE');
    return res.json({ success: true, data: await loadCart(req.user!.id) });
  } catch (error) {
    console.error('Cart read failed:', error);
    return res.status(503).json({ success: false, error: { message: 'Warenkorb konnte nicht aus MariaDB geladen werden.' } });
  }
});

apiRouter.post('/cart', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { productId, quantity = 1 } = req.body;
  if (typeof productId !== 'string' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    return res.status(400).json({ success: false, error: { message: 'Produkt-ID oder Menge ist ungültig.' } });
  }

  try {
    if (!getLastDatabaseStatus().connected) throw new Error('DATABASE_UNAVAILABLE');
    await withTransaction(async (connection) => {
      const cartId = await ensureUserCart(connection, req.user!.id);
      const [products] = await connection.execute<Array<import('mysql2').RowDataPacket & { id: string }>>(
        `SELECT id FROM products WHERE id = ? AND status = 'PUBLISHED' AND visibility = 'PUBLIC' FOR UPDATE`,
        [productId]
      );
      if (products.length === 0) throw new Error('PRODUCT_NOT_AVAILABLE');
      const [cartRows] = await connection.execute<Array<import('mysql2').RowDataPacket & { id: number; quantity: number }>>(
        `SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1 FOR UPDATE`,
        [cartId, productId]
      );
      const existing = cartRows[0];
      if (existing) {
        const nextQuantity = Number(existing.quantity) + quantity;
        if (nextQuantity > 99) throw new Error('QUANTITY_LIMIT');
        await connection.execute(`UPDATE cart_items SET quantity = ? WHERE id = ?`, [nextQuantity, existing.id]);
      } else {
        await connection.execute(`INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)`, [cartId, productId, quantity]);
      }
    });
    return res.json({ success: true, data: await loadCart(req.user!.id) });
  } catch (error) {
    if (error instanceof Error && error.message === 'PRODUCT_NOT_AVAILABLE') {
      return res.status(404).json({ success: false, error: { message: 'Veröffentlichtes Produkt nicht gefunden.' } });
    }
    if (error instanceof Error && error.message === 'QUANTITY_LIMIT') {
      return res.status(400).json({ success: false, error: { message: 'Maximal 99 Stück pro Produkt.' } });
    }
    console.error('Cart add failed:', error);
    return res.status(503).json({ success: false, error: { message: 'Warenkorb konnte nicht in MariaDB aktualisiert werden.' } });
  }
});

apiRouter.delete('/cart/:productId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;
  try {
    if (!getLastDatabaseStatus().connected) throw new Error('DATABASE_UNAVAILABLE');
    await executeQuery(
      `DELETE ci FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE c.user_id = ? AND ci.product_id = ?`,
      [req.user!.id, productId]
    );
    return res.json({ success: true, data: await loadCart(req.user!.id) });
  } catch (error) {
    console.error('Cart remove failed:', error);
    return res.status(503).json({ success: false, error: { message: 'Warenkorb konnte nicht aktualisiert werden.' } });
  }
});

apiRouter.post('/cart/clear', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!getLastDatabaseStatus().connected) throw new Error('DATABASE_UNAVAILABLE');
    await executeQuery(
      `DELETE ci FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE c.user_id = ?`,
      [req.user!.id]
    );
    return res.json({ success: true, message: 'Warenkorb geleert' });
  } catch (error) {
    console.error('Cart clear failed:', error);
    return res.status(503).json({ success: false, error: { message: 'Warenkorb konnte nicht geleert werden.' } });
  }
});

apiRouter.post('/checkout', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  return res.status(501).json({
    success: false,
    error: { message: 'Checkout ist deaktiviert, bis ein echter Payment-Provider eingerichtet ist.' },
  });
});

apiRouter.get('/orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const orders = await orderRepository.findByUserId(req.user!.id);
  res.json({ success: true, data: orders });
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
  try {
    const result = await downloadRepository.verifyAndConsumeToken(req.params.token);
    if (!result.valid || !result.product || !result.entitlement) {
      return res.status(403).json({ success: false, error: { message: result.error || 'Ungültiger Download-Token' } });
    }
    if (!result.product.downloadMediaId) {
      return res.status(404).json({ success: false, error: { message: 'Für dieses Produkt ist keine Download-Datei hinterlegt.' } });
    }
    const media = await mediaRepository.findById(result.product.downloadMediaId);
    if (!media?.storageKey) {
      return res.status(404).json({ success: false, error: { message: 'Download-Datei nicht verfügbar.' } });
    }

    const safeTitle = result.product.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
    const extension = path.extname(media.originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const safeFilename = `${safeTitle}_v${result.product.version || '1.0.0'}${extension}`;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    await auditRepository.log('FILE_DOWNLOADED', result.entitlement.userId, 'Customer', `Download: ${safeFilename}`, ip);

    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const stream = mediaStorage.createReadStream(media.storageKey);
    stream.on('error', (error) => {
      console.error('Protected download failed:', error);
      if (!res.headersSent) res.status(404).json({ success: false, error: { message: 'Download-Datei nicht verfügbar.' } });
      else res.destroy(error);
    });
    return stream.pipe(res);
  } catch (error) {
    console.error('Download authorization failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Download konnte nicht autorisiert werden.' } });
  }
});

// -------------------------------------------------------------
// 5.2 MEDIA MANAGEMENT API (Sections 19, 21)
// -------------------------------------------------------------
apiRouter.get('/media', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAll = isAdmin(req.user) && req.query.all === 'true';
    const ownerId = isAll ? undefined : req.user!.id;
    const category = req.query.category ? String(req.query.category) : undefined;
    const list = await mediaRepository.findAll({ ownerId, fileCategory: category });
    return res.json({ success: true, data: list.map(({ storageKey: _storageKey, ...media }) => media) });
  } catch (error) {
    console.error('Media list query failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Medien konnten nicht aus MariaDB geladen werden.' } });
  }
});

apiRouter.post(
  '/media/upload',
  requireRole('CREATOR', 'ADMIN'),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    mediaStorage.upload.single('file')(req, res, (error) => {
      if (error) {
        const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ success: false, error: { message: 'Datei fehlt, ist zu groß oder hat einen nicht unterstützten Typ.' } });
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: { message: 'Eine Datei ist erforderlich.' } });
    }
    const fileCategory = getUploadCategory(file.originalname, file.mimetype);
    const maxBytes = fileCategory === 'image' ? 15 * 1024 * 1024 : 100 * 1024 * 1024;
    if (!fileCategory || file.size > maxBytes) {
      await mediaStorage.remove(file.filename).catch((error) => console.error('Rejected upload cleanup failed:', error));
      return res.status(file.size > maxBytes ? 413 : 400).json({ success: false, error: { message: 'Dateityp oder Dateigröße ist nicht erlaubt.' } });
    }
    const validSignature = await mediaStorage.verifyFile(file.path, file.originalname).catch((error) => {
      console.error('Upload signature check failed:', error);
      return false;
    });
    if (!validSignature) {
      await mediaStorage.remove(file.filename).catch((error) => console.error('Invalid upload cleanup failed:', error));
      return res.status(415).json({ success: false, error: { message: 'Der Dateiinhalt passt nicht zur angegebenen Endung.' } });
    }

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
        fileCategory,
      });
      await logAudit('UPLOAD_MEDIA', `Medienobjekt gespeichert: ${file.originalname}`, req);
      const { storageKey: _storageKey, ...responseMedia } = media;
      return res.status(201).json({ success: true, data: responseMedia });
    } catch (error) {
      await mediaStorage.remove(file.filename).catch((cleanupError) => console.error('Failed to remove unregistered upload:', cleanupError));
      console.error('Media upload failed:', error);
      return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Datei konnte nicht dauerhaft registriert werden.' } });
    }
  }
);

apiRouter.get('/media/:id/file', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const media = await mediaRepository.findById(req.params.id);
    if (!media || !media.storageKey) {
      return res.status(404).json({ success: false, error: { message: 'Datei nicht gefunden.' } });
    }
    const ownerAccess = req.user?.id === media.ownerId || isAdmin(req.user);
    const publicImage = media.fileCategory === 'image' && await mediaRepository.isPubliclyLinked(media.id);
    if (!ownerAccess && !publicImage) {
      return res.status(403).json({ success: false, error: { message: 'Kein Zugriff auf diese Datei.' } });
    }

    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${media.originalName.replace(/["\\\r\n]/g, '_')}"`);
    res.setHeader('Cache-Control', publicImage ? 'public, max-age=300' : 'private, no-store');
    const stream = mediaStorage.createReadStream(media.storageKey);
    stream.on('error', (error) => {
      console.error('Media file read failed:', error);
      if (!res.headersSent) res.status(404).json({ success: false, error: { message: 'Datei nicht verfügbar.' } });
      else res.destroy(error);
    });
    return stream.pipe(res);
  } catch (error) {
    console.error('Media file request failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Datei konnte nicht geladen werden.' } });
  }
});

apiRouter.post('/media', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.status(410).json({
    success: false,
    error: { message: 'Metadaten-Uploads sind deaktiviert. Verwende den Multipart-Dateiupload.' },
  });
});

apiRouter.delete('/media/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const adminAccess = isAdmin(req.user);
  const media = await mediaRepository.findById(req.params.id);
  if (!media) return res.status(404).json({ success: false, error: { message: 'Datei nicht gefunden.' } });
  if (!adminAccess && media.ownerId !== req.user!.id) {
    return res.status(403).json({ success: false, error: { message: 'Du darfst diese Datei nicht löschen.' } });
  }
  try {
    const success = await mediaRepository.delete(req.params.id, adminAccess ? undefined : req.user!.id);
    if (!success) return res.status(404).json({ success: false, error: { message: 'Datei nicht gefunden.' } });
    if (media.storageKey) await mediaStorage.remove(media.storageKey);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (code === 'MEDIA_REFERENCED' || code === 'ER_ROW_IS_REFERENCED_2' || code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({ success: false, error: { message: 'Datei wird noch von einem Projekt oder Produkt verwendet.' } });
    }
    console.error('Media delete failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Datei konnte nicht gelöscht werden.' } });
  }
  await logAudit('DELETE_MEDIA', `Medienobjekt gelöscht: ${req.params.id}`, req);
  return res.json({ success: true, message: 'Datei gelöscht' });
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
  const filterByAuthor = isAdmin(req.user) ? undefined : userId;

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
});

// -------------------------------------------------------------
// 6. COMMUNITY API (Section 27 & RBAC Moderation)
// -------------------------------------------------------------
apiRouter.get('/community/posts', async (req: Request, res: Response) => {
  const { category } = req.query;
  const posts = await communityRepository.getPosts(category ? String(category) : undefined);
  res.json({ success: true, data: posts });
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

apiRouter.post('/community/posts/:id/like', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const likes = await communityRepository.likePost(req.params.id);
  res.json({ success: true, data: { likes } });
});

// Moderation: Delete post
apiRouter.delete('/community/posts/:id', requireRole('MODERATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const deleted = await communityRepository.deletePost(req.params.id);
  await logAudit('MODERATE_DELETE_POST', `Beitrag ${req.params.id} moderiert/gelöscht`, req);
  res.json({ success: true, message: 'Beitrag gelöscht', deleted });
});

// Moderation: Delete comment
apiRouter.delete(
  '/community/posts/:postId/comments/:commentId',
  requireRole('MODERATOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const deleted = await communityRepository.deleteComment(req.params.postId, req.params.commentId);
    await logAudit('MODERATE_DELETE_COMMENT', `Kommentar moderiert/gelöscht`, req);
    res.json({ success: true, message: 'Kommentar gelöscht', deleted });
  }
);

// -------------------------------------------------------------
// 7. PERSISTENT AI CONVERSATIONS & HISTORY (Sections 28, 29)
// -------------------------------------------------------------
apiRouter.get('/ai/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const convs = await aiConversationRepository.getConversations(req.user!.id);
  return res.json({ success: true, data: convs });
});

apiRouter.post('/ai/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { title, role } = req.body;
  const conv = await aiConversationRepository.createConversation(
    req.user!.id,
    typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : 'Neues Gespräch',
    typeof role === 'string' ? role.slice(0, 50) : 'general'
  );
  return res.status(201).json({ success: true, data: conv });
});

apiRouter.get('/ai/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const conversations = await executeQuery<any>(`SELECT user_id FROM ai_conversations WHERE id = ? LIMIT 1`, [req.params.id]);
  if (!conversations.length) return res.status(404).json({ success: false, error: { message: 'Konversation nicht gefunden.' } });
  if (conversations[0].user_id !== req.user!.id && !isAdmin(req.user)) {
    return res.status(403).json({ success: false, error: { message: 'Kein Zugriff auf diese Konversation.' } });
  }
  const messages = await aiConversationRepository.getMessages(req.params.id);
  return res.json({ success: true, data: messages });
});

apiRouter.post('/ai/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { role, content, model } = req.body;
  const conversations = await executeQuery<any>(`SELECT user_id FROM ai_conversations WHERE id = ? LIMIT 1`, [req.params.id]);
  if (!conversations.length) return res.status(404).json({ success: false, error: { message: 'Konversation nicht gefunden.' } });
  if (conversations[0].user_id !== req.user!.id && !isAdmin(req.user)) {
    return res.status(403).json({ success: false, error: { message: 'Kein Zugriff auf diese Konversation.' } });
  }
  if (role !== 'user' || typeof content !== 'string' || !content.trim() || content.length > 50000) {
    return res.status(400).json({ success: false, error: { message: 'Ungültige Nachricht.' } });
  }
  const message = await aiConversationRepository.addMessage(
    req.params.id,
    'user',
    content.trim(),
    typeof model === 'string' ? model.slice(0, 100) : 'gemini-3.5-flash'
  );
  return res.status(201).json({ success: true, data: message });
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
apiRouter.get('/admin/stats', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [dbHealth, userCount, projectCount, productCount, orderStats, postCount] = await Promise.all([
      databaseHealthService.checkHealth(),
      executeQuery<any>(`SELECT COUNT(*) AS total FROM users`),
      executeQuery<any>(`SELECT COUNT(*) AS total FROM projects`),
      executeQuery<any>(`SELECT COUNT(*) AS total FROM products`),
      executeQuery<any>(`SELECT COUNT(*) AS total, COALESCE(SUM(total_amount), 0) AS revenue FROM orders`),
      executeQuery<any>(`SELECT COUNT(*) AS total FROM posts`),
    ]);
    return res.json({
      success: true,
      data: {
        totalUsers: Number(userCount[0]?.total || 0),
        totalProjects: Number(projectCount[0]?.total || 0),
        totalProducts: Number(productCount[0]?.total || 0),
        totalOrders: Number(orderStats[0]?.total || 0),
        totalRevenue: Number(orderStats[0]?.revenue || 0),
        totalPosts: Number(postCount[0]?.total || 0),
        database: {
          connected: dbHealth.database.connected,
          type: dbHealth.database.type,
          latencyMs: dbHealth.database.latencyMs,
        },
        infrastructure: {
          server: 'HP EliteDesk 800 G3 Mini',
          dockerContainers: 0,
          tailscale: 'UNKNOWN',
          nginxProxyManager: 'UNKNOWN',
        },
      },
    });
  } catch (error) {
    console.error('Admin statistics query failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Admin-Statistiken konnten nicht aus MariaDB geladen werden.' } });
  }
});

apiRouter.get('/admin/users', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const users = await userRepository.getAllUsers();
  res.json({ success: true, data: users.map((u) => authService.sanitizeUser(u)) });
});

apiRouter.patch('/admin/users/:id/role', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const updated = await userRepository.updateRole(req.params.id, req.body.role);
  await logAudit('USER_ROLE_CHANGED', `Rolle von ${req.params.id} geändert auf ${req.body.role}`, req);
  res.json({ success: true, data: updated ? authService.sanitizeUser(updated) : null });
});

apiRouter.patch('/admin/users/:id/status', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const updated = await userRepository.toggleStatus(req.params.id);
  await logAudit('USER_STATUS_TOGGLED', `Status von ${req.params.id} umgeschaltet`, req);
  res.json({ success: true, data: updated ? authService.sanitizeUser(updated) : null });
});

apiRouter.get('/admin/audit-logs', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const logs = await auditRepository.getAuditLogs(50);
  res.json({ success: true, data: logs });
});

apiRouter.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await executeQuery<any>(
      `SELECT id, user_id AS userId, title, message, read_status AS read, notification_type AS type, created_at AS createdAt
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user!.id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Notification query failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Benachrichtigungen konnten nicht geladen werden.' } });
  }
});

apiRouter.post('/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await executeQuery(`UPDATE notifications SET read_status = 1 WHERE user_id = ?`, [req.user!.id]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Notification update failed:', error);
    return res.status(getLastDatabaseStatus().connected ? 500 : 503).json({ success: false, error: { message: 'Benachrichtigungen konnten nicht aktualisiert werden.' } });
  }
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
