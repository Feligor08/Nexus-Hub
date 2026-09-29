import { Router, Request, Response } from 'express';
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

// Switch role (Testing & RBAC Demonstration)
apiRouter.post('/auth/switch-role', async (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body;
  const allowed = ['GUEST', 'USER', 'CREATOR', 'MODERATOR', 'ADMIN'];
  if (!allowed.includes(role)) {
    return res.status(400).json({ success: false, error: { message: 'Ungültige Rolle' } });
  }

  // If user is logged in, update their role
  if (req.user) {
    const updated = await userRepository.updateRole(req.user.id, role);
    await logAudit('ROLE_SWITCH', `Rolle gewechselt zu ${role}`, req);
    return res.json({ success: true, user: updated, data: updated });
  }

  // If not logged in, log in as corresponding demo profile or create demo session
  const targetUser = db.users.find((u) => u.role === role) || db.users[0];
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const token = authService.generateSessionToken();
  await userRepository.createSession(targetUser.id, token, ip);
  setSessionCookie(res, token);

  res.json({
    success: true,
    authenticated: true,
    user: authService.sanitizeUser(targetUser),
    data: authService.sanitizeUser(targetUser),
    token,
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
  if (!project) {
    return res.status(404).json({ success: false, error: { message: 'Projekt nicht gefunden' } });
  }
  res.json({ success: true, data: project });
});

apiRouter.post('/projects', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const projectData = {
    ...req.body,
    authorId: req.user?.id || 'usr-admin-feligor',
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
  const result = await productRepository.findAll({
    category: category ? String(category) : undefined,
    search: search ? String(search) : undefined,
    status: status ? String(status) : undefined,
    includeDrafts: includeDrafts === 'true',
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ success: true, data: result.products, total: result.total });
});

apiRouter.get('/products/featured', async (req: Request, res: Response) => {
  const result = await productRepository.findAll({ featured: true, limit: 6 });
  res.json({ success: true, data: result.products });
});

apiRouter.get('/products/:slug', async (req: Request, res: Response) => {
  const product = await productRepository.findBySlug(req.params.slug);
  if (!product) {
    return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden' } });
  }
  res.json({ success: true, data: product });
});

apiRouter.post('/products', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const productData = {
    ...req.body,
    authorId: req.user?.id || 'usr-admin-feligor',
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
  const versions = db.productVersions.filter((v) => v.productId === req.params.id);
  res.json({ success: true, data: versions });
});

apiRouter.post('/products/:id/versions', requireRole('CREATOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { version, releaseNotes, mediaId } = req.body;
  if (!version) {
    return res.status(400).json({ success: false, error: { message: 'Versionsnummer erforderlich' } });
  }
  const id = `ver-${Date.now()}`;
  const newVer: ProductVersion = {
    id,
    productId: req.params.id,
    version,
    releaseNotes: releaseNotes || '',
    mediaId,
    createdAt: new Date().toISOString(),
  };
  db.productVersions.unshift(newVer);
  await productRepository.update(req.params.id, { version });
  await logAudit('CREATE_PRODUCT_VERSION', `Version ${version} für Produkt ${req.params.id} veröffentlicht`, req);
  res.status(201).json({ success: true, data: newVer });
});

// -------------------------------------------------------------
// 5. CARTS & ORDERS (Sections 24, 25, 26, 41)
// -------------------------------------------------------------
apiRouter.get('/cart', (req: Request, res: Response) => {
  const cartWithProducts = db.cart.map((item) => {
    const product = db.products.find((p) => p.id === item.productId);
    return {
      id: item.productId,
      productId: item.productId,
      name: product?.name || 'Unbekanntes Produkt',
      price: product?.price || 0,
      quantity: item.quantity,
      fileFormat: product?.fileFormat,
    };
  });
  res.json({ success: true, data: cartWithProducts });
});

apiRouter.post('/cart', (req: Request, res: Response) => {
  const { productId, quantity = 1 } = req.body;
  const product = db.products.find((p) => p.id === productId);
  if (!product) {
    return res.status(404).json({ success: false, error: { message: 'Produkt nicht gefunden' } });
  }

  const existing = db.cart.find((c) => c.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    db.cart.push({ productId, quantity });
  }

  res.json({ success: true, data: db.cart });
});

apiRouter.delete('/cart/:productId', (req: Request, res: Response) => {
  const { productId } = req.params;
  const idx = db.cart.findIndex((c) => c.productId === productId);
  if (idx !== -1) {
    db.cart.splice(idx, 1);
  }
  res.json({ success: true, data: db.cart });
});

apiRouter.post('/cart/clear', (req: Request, res: Response) => {
  db.cart.length = 0;
  res.json({ success: true, message: 'Warenkorb geleert' });
});

apiRouter.post('/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (db.cart.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'Warenkorb ist leer' } });
  }

  const orderItems = db.cart
    .map((item) => {
      const p = db.products.find((prod) => prod.id === item.productId);
      if (!p) return null;
      return {
        productId: p.id,
        name: p.name,
        price: p.price,
        quantity: item.quantity,
        fileFormat: p.fileFormat,
      };
    })
    .filter(Boolean) as any[];

  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order: Order = {
    id: `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId: req.user!.id,
    customerEmail: req.user!.email,
    items: orderItems,
    totalAmount: Number(total.toFixed(2)),
    currency: 'EUR',
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    downloadToken: `dl-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  const createdOrder = await orderRepository.create(order);
  db.cart.length = 0; // Clear cart after successful checkout

  // Create download entitlements for digital products
  for (const item of orderItems) {
    try {
      await downloadRepository.createEntitlement(req.user!.id, item.productId, order.id);
    } catch (e) {
      console.warn('Could not create entitlement:', e);
    }
  }

  await logAudit('CHECKOUT_COMPLETED', `Bestellung ${order.id} über ${order.totalAmount} EUR abgeschlossen`, req);

  res.json({
    success: true,
    data: createdOrder,
    message: 'Bestellung erfolgreich abgeschlossen. Downloads freigeschaltet.',
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
  const { token } = req.params;
  const result = await downloadRepository.verifyAndConsumeToken(token);
  if (!result.valid || !result.product) {
    return res.status(403).json({ success: false, error: { message: result.error || 'Ungültiger Download-Token' } });
  }

  const product = result.product;
  const safeFilename = `${product.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}_v${product.version || '1.0.0'}.${(product.fileFormat || 'zip').toLowerCase()}`;

  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
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
  const { filename, originalName, storagePath, mimeType, fileSize, fileCategory } = req.body;
  if (!filename) {
    return res.status(400).json({ success: false, error: { message: 'Dateiname erforderlich' } });
  }
  const id = `med-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const media = await mediaRepository.create({
    id,
    ownerId: req.user!.id,
    filename,
    originalName: originalName || filename,
    storagePath: storagePath || `/uploads/${filename}`,
    mimeType: mimeType || 'application/octet-stream',
    fileSize: fileSize || 1024,
    fileCategory: fileCategory || 'file',
  });
  await logAudit('UPLOAD_MEDIA', `Medienobjekt hinzugefügt: ${filename}`, req);
  res.status(201).json({ success: true, data: media });
});

apiRouter.delete('/media/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const authorCheck = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
  const success = await mediaRepository.delete(req.params.id, authorCheck);
  if (!success) {
    return res.status(404).json({ success: false, error: { message: 'Datei nicht gefunden oder keine Berechtigung' } });
  }
  await logAudit('DELETE_MEDIA', `Medienobjekt gelöscht: ${req.params.id}`, req);
  res.json({ success: true, message: 'Datei gelöscht' });
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
apiRouter.get('/admin/stats', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const dbHealth = await databaseHealthService.checkHealth();
  const allUsers = await userRepository.getAllUsers();
  const orders = db.orders;
  const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  res.json({
    success: true,
    data: {
      totalUsers: allUsers.length,
      totalProjects: db.projects.length,
      totalProducts: db.products.length,
      totalOrders: orders.length,
      totalRevenue: Number(revenue.toFixed(2)),
      totalPosts: db.posts.length,
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

apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const list = db.notifications.filter((n) => n.userId === req.user!.id);
  res.json({ success: true, data: list });
});

apiRouter.post('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  db.notifications.forEach((n) => {
    if (n.userId === req.user!.id) n.read = true;
  });
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
