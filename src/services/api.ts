import {
  User,
  Project,
  Product,
  Order,
  Post,
  Notification,
  AdminStats,
  AuditLog,
  SystemHealthData,
  DatabaseInfo,
  MediaFile,
  DownloadEntitlement,
  CreatorApplication,
  CommunityReport,
} from '../types/platform';

let memorySessionToken: string | null = null;

// Read initial token from sessionStorage (safe tab session only, never in localStorage per security rule)
try {
  memorySessionToken = sessionStorage.getItem('nexus_session_token');
} catch {
  // Ignore sessionStorage restriction if any
}

export function setSessionToken(token: string | null) {
  memorySessionToken = token;
  try {
    if (token) {
      sessionStorage.setItem('nexus_session_token', token);
    } else {
      sessionStorage.removeItem('nexus_session_token');
    }
  } catch {
    // Ignore
  }
}

export function getSessionToken(): string | null {
  return memorySessionToken;
}

/**
 * Universal fetch wrapper ensuring HttpOnly cookies and Bearer tokens are dispatched
 */
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (memorySessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${memorySessionToken}`);
    headers.set('x-session-token', memorySessionToken);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Guarantees HttpOnly cookies are attached
  });
}

async function safeJson<T = any>(res: Response, fallback: T): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return fallback;
  }
  try {
    return await res.json();
  } catch {
    return fallback;
  }
}

async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      !res.ok
        ? `Serverfehler (${res.status}): Die Anfrage konnte nicht verarbeitet werden.`
        : 'Ungültige Serverantwort (kein JSON).'
    );
  }
  try {
    return await res.json();
  } catch {
    throw new Error(`Fehler beim Parsen der Serverantwort (${res.status}).`);
  }
}

export const api = {
  // Database & Health Checks (Sections 10, 11, 31)
  async getHealth(): Promise<any> {
    const res = await fetchWithAuth('/api/health');
    return safeJson(res, { success: false, status: 'OFFLINE' });
  },

  async getDatabaseHealth(): Promise<{ success: boolean; database: DatabaseInfo }> {
    const res = await fetchWithAuth('/api/health/database');
    return safeJson(res, {
      success: false,
      database: { connected: false, type: 'MariaDB', diagnosticCode: 'DB_CONNECTION_FAILED' } as any,
    });
  },

  async getSystemHealth(): Promise<SystemHealthData> {
    const res = await fetchWithAuth('/api/admin/system-health');
    const json = await safeJson<{ success: boolean; data?: SystemHealthData }>(res, { success: false });
    return json.data || {
      status: 'OFFLINE',
      platform: 'Nexus Code Play',
      database: { connected: false, type: 'MariaDB' },
      services: {},
      infrastructure: {},
      timestamp: new Date().toISOString(),
    };
  },

  async runDatabaseMigrations(): Promise<any> {
    const res = await fetchWithAuth('/api/database/migrate', {
      method: 'POST',
    });
    return safeJson(res, { success: false, message: 'Migration request failed' });
  },

  // Real Authentication (Sprint 5)
  async getMe(): Promise<{ authenticated: boolean; user: User | null }> {
    const res = await fetchWithAuth('/api/auth/me');
    if (res.status === 401) {
      setSessionToken(null);
      return { authenticated: false, user: null };
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { authenticated: false, user: null };
    }
    const json = await safeJson<any>(res, { authenticated: false, user: null });
    return {
      authenticated: !!json.authenticated,
      user: json.user || json.data || null,
    };
  },

  async register(data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ success: boolean; authenticated: boolean; user: User; token: string }> {
    const res = await fetchWithAuth('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Registrierung fehlgeschlagen');
    }
    if (json.token) {
      setSessionToken(json.token);
    }
    return json;
  },

  async login(data: {
    emailOrUsername?: string;
    email?: string;
    password: string;
  }): Promise<{ success: boolean; authenticated: boolean; user: User; token: string }> {
    const res = await fetchWithAuth('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'E-Mail/Benutzername oder Passwort ist falsch.');
    }
    if (json.token) {
      setSessionToken(json.token);
    }
    return json;
  },

  async logout(): Promise<void> {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } finally {
      setSessionToken(null);
    }
  },

  async updateProfile(profileData: Partial<User>): Promise<User> {
    const res = await fetchWithAuth('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Fehler beim Aktualisieren des Profils');
    }
    return json.user || json.data;
  },

  async getUserByUsername(username: string): Promise<User> {
    const res = await fetchWithAuth(`/api/users/${encodeURIComponent(username)}`);
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Benutzer nicht gefunden');
    return json.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithAuth('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Passwortänderung fehlgeschlagen');
    }
    if (json.token) {
      setSessionToken(json.token);
    }
    return json;
  },

  async getCreatorApplication(): Promise<CreatorApplication | null> {
    const res = await fetchWithAuth('/api/creator/application');
    if (!res.ok) return null;
    const json = await safeJson<{ success: boolean; data?: CreatorApplication }>(res, { success: false });
    return json.data || null;
  },

  async submitCreatorApplication(data: {
    portfolioUrl?: string;
    motivation: string;
    plannedProjects: string;
    plannedContent: string;
  }): Promise<CreatorApplication> {
    const res = await fetchWithAuth('/api/creator/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Fehler beim Einreichen des Creator-Antrags');
    }
    return json.data;
  },

  // Projects / Portfolio
  async getProjects(category?: string, search?: string): Promise<Project[]> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search) params.set('search', search);

    const res = await fetchWithAuth(`/api/projects?${params.toString()}`);
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: Project[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async getPublicProjects(category?: string, search?: string): Promise<Project[]> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search) params.set('search', search);

    const res = await fetchWithAuth(`/api/projects/public?${params.toString()}`);
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: Project[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async getFeaturedProjects(): Promise<Project[]> {
    const res = await fetchWithAuth('/api/projects/featured');
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: Project[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async getProjectBySlug(slug: string): Promise<Project> {
    const res = await fetchWithAuth(`/api/projects/${encodeURIComponent(slug)}`);
    const json = await safeJson<{ success: boolean; data?: Project; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Projekt nicht gefunden');
    return json.data;
  },

  async createProject(projectData: Partial<Project>): Promise<Project> {
    const res = await fetchWithAuth('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
    const json = await safeJson<{ success: boolean; data?: Project; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Fehler beim Erstellen des Projekts');
    return json.data;
  },

  async updateProject(id: string, projectData: Partial<Project>): Promise<Project> {
    const res = await fetchWithAuth(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
    const json = await safeJson<{ success: boolean; data?: Project; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Fehler beim Aktualisieren des Projekts');
    return json.data;
  },

  async publishProject(id: string): Promise<Project> {
    const res = await fetchWithAuth(`/api/projects/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
    });
    const json = await safeJson<{ success: boolean; data?: Project; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Projekt konnte nicht veröffentlicht werden');
    return json.data;
  },

  async unpublishProject(id: string): Promise<Project> {
    const res = await fetchWithAuth(`/api/projects/${encodeURIComponent(id)}/unpublish`, {
      method: 'POST',
    });
    const json = await safeJson<{ success: boolean; data?: Project; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Projekt konnte nicht zurückgezogen werden');
    return json.data;
  },

  async updateProjectStatus(id: string, status: string): Promise<Project> {
    const res = await fetchWithAuth(`/api/projects/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const json = await safeJson<{ success: boolean; data?: Project; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Fehler beim Ändern des Projekt-Status');
    return json.data;
  },

  async deleteProject(id: string): Promise<void> {
    const res = await fetchWithAuth(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await safeJson<{ success: boolean; error?: { message: string } }>(res, { success: false });
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Löschen des Projekts');
  },

  // Products / Store
  async getProducts(category?: string, search?: string, includeDrafts?: boolean, status?: string): Promise<Product[]> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search) params.set('search', search);
    if (includeDrafts) params.set('includeDrafts', 'true');
    if (status) params.set('status', status);

    const res = await fetchWithAuth(`/api/products?${params.toString()}`);
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: Product[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async getPublicProducts(category?: string, search?: string): Promise<Product[]> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search) params.set('search', search);

    const res = await fetchWithAuth(`/api/products/public?${params.toString()}`);
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: Product[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async getFeaturedProducts(): Promise<Product[]> {
    const res = await fetchWithAuth('/api/products/featured');
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: Product[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async getProductBySlug(slug: string): Promise<Product> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(slug)}`);
    const json = await safeJson<{ success: boolean; data?: Product; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Produkt nicht gefunden');
    return json.data;
  },

  async createProduct(productData: Partial<Product>): Promise<Product> {
    const res = await fetchWithAuth('/api/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
    const json = await safeJson<{ success: boolean; data?: Product; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Fehler beim Erstellen des Produkts');
    return json.data;
  },

  async updateProduct(id: string, productData: Partial<Product>): Promise<Product> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
    const json = await safeJson<{ success: boolean; data?: Product; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Fehler beim Aktualisieren des Produkts');
    return json.data;
  },

  async publishProduct(id: string): Promise<Product> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
    });
    const json = await safeJson<{ success: boolean; data?: Product; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Produkt konnte nicht veröffentlicht werden');
    return json.data;
  },

  async unpublishProduct(id: string): Promise<Product> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}/unpublish`, {
      method: 'POST',
    });
    const json = await safeJson<{ success: boolean; data?: Product; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Produkt konnte nicht zurückgezogen werden');
    return json.data;
  },

  async updateProductStatus(id: string, status: string): Promise<Product> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const json = await safeJson<{ success: boolean; data?: Product; error?: { message: string } }>(res, { success: false });
    if (!res.ok || !json.data) throw new Error(json.error?.message || 'Fehler beim Ändern des Produkt-Status');
    return json.data;
  },

  async deleteProduct(id: string): Promise<void> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await safeJson<{ success: boolean; error?: { message: string } }>(res, { success: false });
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Löschen des Produkts');
  },

  async claimFreeProduct(id: string): Promise<{ order: Order; entitlement: DownloadEntitlement; downloadToken: string; expiresAt: string }> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}/claim-free`, {
      method: 'POST',
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Kostenloses Produkt konnte nicht aktiviert werden');
    return json.data;
  },

  async getProductVersions(productId: string): Promise<any[]> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(productId)}/versions`);
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: any[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async createProductVersion(productId: string, versionData: { version: string; releaseNotes?: string; mediaId?: string }): Promise<any> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(productId)}/versions`, {
      method: 'POST',
      body: JSON.stringify(versionData),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Anlegen der Version');
    return json.data;
  },

  // Media Management
  async getMedia(all = false, category?: string): Promise<MediaFile[]> {
    const params = new URLSearchParams();
    if (all) params.set('all', 'true');
    if (category && category !== 'all') params.set('category', category);
    const res = await fetchWithAuth(`/api/media?${params.toString()}`);
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: MediaFile[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async uploadMedia(mediaData: File | { filename: string; originalName?: string; storagePath?: string; mimeType?: string; fileSize?: number; fileCategory?: 'image' | 'file' | 'document' | '3d' }): Promise<MediaFile> {
    if (mediaData instanceof File) {
      const formData = new FormData();
      formData.append('file', mediaData);
      const res = await fetchWithAuth('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await parseJsonResponse<any>(res);
      if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Hochladen der Mediendatei');
      return json.data;
    }

    const res = await fetchWithAuth('/api/media', {
      method: 'POST',
      body: JSON.stringify(mediaData),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Hochladen der Mediendatei');
    return json.data;
  },

  async deleteMedia(id: string): Promise<void> {
    const res = await fetchWithAuth(`/api/media/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Löschen der Mediendatei');
  },

  // Downloads & Entitlements
  async getEntitlements(): Promise<DownloadEntitlement[]> {
    const res = await fetchWithAuth('/api/downloads/entitlements');
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: DownloadEntitlement[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async getDownloadToken(entitlementId: string): Promise<{ token: string; expiresAt: string; downloadUrl: string }> {
    const res = await fetchWithAuth(`/api/downloads/token/${encodeURIComponent(entitlementId)}`, {
      method: 'POST',
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Download-Berechtigung konnte nicht verifiziert werden');
    return json.data;
  },

  // CMS Dashboard Stats
  async getCmsStats(): Promise<{
    totalProjects: number;
    totalProducts: number;
    totalPosts: number;
    totalMedia: number;
    draftsCount: number;
    publishedCount: number;
    archivedCount: number;
    projects: Project[];
    products: Product[];
  }> {
    const res = await fetchWithAuth('/api/cms/stats');
    const json = await safeJson<{
      success: boolean;
      data?: {
        totalProjects: number;
        totalProducts: number;
        totalPosts: number;
        totalMedia: number;
        draftsCount: number;
        publishedCount: number;
        archivedCount: number;
        projects: Project[];
        products: Product[];
      };
      error?: { message: string };
    }>(res, {
      success: false,
      data: {
        totalProjects: 0,
        totalProducts: 0,
        totalPosts: 0,
        totalMedia: 0,
        draftsCount: 0,
        publishedCount: 0,
        archivedCount: 0,
        projects: [],
        products: [],
      },
    });
    if (!res.ok && !json.data) throw new Error(json.error?.message || 'Fehler beim Abrufen der CMS-Statistiken');
    return json.data || {
      totalProjects: 0,
      totalProducts: 0,
      totalPosts: 0,
      totalMedia: 0,
      draftsCount: 0,
      publishedCount: 0,
      archivedCount: 0,
      projects: [],
      products: [],
    };
  },

  // Cart
  async getCart(): Promise<any[]> {
    const res = await fetchWithAuth('/api/cart');
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: any[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async addToCart(productId: string, quantity = 1): Promise<any[]> {
    const res = await fetchWithAuth('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Hinzufügen zum Warenkorb');
    return json.data || [];
  },

  async updateCartQuantity(productId: string, quantity: number): Promise<any[]> {
    const res = await fetchWithAuth(`/api/cart/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Aktualisieren des Warenkorbs');
    return json.data || [];
  },

  async removeFromCart(productId: string): Promise<any[]> {
    const res = await fetchWithAuth(`/api/cart/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Entfernen aus dem Warenkorb');
    return json.data || [];
  },

  async clearCart(): Promise<void> {
    await fetchWithAuth('/api/cart/clear', { method: 'POST' });
  },

  async checkout(): Promise<Order> {
    const res = await fetchWithAuth('/api/checkout', {
      method: 'POST',
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Checkout fehlgeschlagen');
    return json.data;
  },

  async getOrders(): Promise<Order[]> {
    const res = await fetchWithAuth('/api/orders');
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: Order[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  // Community
  async getPosts(category?: string, search?: string, tag?: string): Promise<Post[]> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search && search.trim()) params.set('search', search.trim());
    if (tag && tag.trim()) params.set('tag', tag.trim());

    const res = await fetchWithAuth(`/api/community/posts?${params.toString()}`);
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: Post[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async getPostById(postId: string): Promise<Post> {
    const res = await fetchWithAuth(`/api/community/posts/${encodeURIComponent(postId)}`);
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Beitrag nicht gefunden');
    return json.data;
  },

  async createPost(
    titleOrData: string | { title: string; content: string; category?: string; tags?: string[] },
    content?: string,
    category?: string,
    tags?: string[]
  ): Promise<Post> {
    const payload =
      typeof titleOrData === 'object'
        ? titleOrData
        : {
            title: titleOrData,
            content: content || '',
            category: category || 'DevOps',
            tags: tags || [],
          };

    const res = await fetchWithAuth('/api/community/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Erstellen des Beitrags');
    return json.data;
  },

  async updatePost(
    postId: string,
    data: { title?: string; content?: string; category?: string; tags?: string[] }
  ): Promise<Post> {
    const res = await fetchWithAuth(`/api/community/posts/${encodeURIComponent(postId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Bearbeiten des Beitrags');
    return json.data;
  },

  async likePost(postId: string): Promise<number> {
    const res = await fetchWithAuth(`/api/community/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
    });
    const json = await parseJsonResponse<any>(res);
    return json.data?.likes ?? 0;
  },

  async addComment(postId: string, content: string): Promise<any> {
    const res = await fetchWithAuth(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    const json = await parseJsonResponse<any>(res);
    return json.data;
  },

  async updateComment(postId: string, commentId: string, content: string): Promise<any> {
    const res = await fetchWithAuth(
      `/api/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }
    );
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Bearbeiten des Kommentars');
    return json.data;
  },

  async deletePost(postId: string): Promise<void> {
    const res = await fetchWithAuth(`/api/community/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Löschen des Beitrags');
  },

  async deleteComment(postId: string, commentId: string): Promise<void> {
    const res = await fetchWithAuth(
      `/api/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE' }
    );
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Löschen des Kommentars');
  },

  async reportPost(postId: string, reason: string): Promise<CommunityReport> {
    const res = await fetchWithAuth(`/api/community/posts/${encodeURIComponent(postId)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Melden des Beitrags');
    return json.data;
  },

  async reportComment(postId: string, commentId: string, reason: string): Promise<CommunityReport> {
    const res = await fetchWithAuth(
      `/api/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/report`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Melden des Kommentars');
    return json.data;
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const res = await fetchWithAuth('/api/notifications');
    if (!res.ok) return [];
    const json = await safeJson<{ success: boolean; data?: Notification[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async markAllNotificationsRead(): Promise<void> {
    await fetchWithAuth('/api/notifications/read-all', { method: 'POST' });
  },

  // Admin & Governance
  async getAdminStats(): Promise<AdminStats> {
    const res = await fetchWithAuth('/api/admin/stats');
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Zugriff verweigert');
    return json.data;
  },

  async getAdminUsers(): Promise<User[]> {
    const res = await fetchWithAuth('/api/admin/users');
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Zugriff verweigert');
    return json.data;
  },

  async updateAdminUserRole(userId: string, role: string): Promise<User> {
    const res = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Aktualisieren der Rolle');
    return json.data;
  },

  async toggleAdminUserStatus(userId: string): Promise<User> {
    const res = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Umschalten des Status');
    return json.data;
  },

  async getAdminAuditLogs(): Promise<AuditLog[]> {
    const res = await fetchWithAuth('/api/admin/audit-logs');
    const json = await parseJsonResponse<any>(res);
    if (!res.ok) throw new Error(json.error?.message || 'Zugriff verweigert');
    return json.data;
  },

  async getAdminCreatorApplications(params?: { status?: string; page?: number; limit?: number }): Promise<{ applications: CreatorApplication[]; total: number }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const res = await fetchWithAuth(`/api/admin/creator-applications?${qs.toString()}`);
    const json = await safeJson<{ success: boolean; data?: CreatorApplication[]; total?: number }>(res, { success: false, data: [], total: 0 });
    return { applications: json.data || [], total: json.total || 0 };
  },

  async reviewCreatorApplication(id: string, status: 'APPROVED' | 'REJECTED', adminNotes?: string): Promise<CreatorApplication> {
    const res = await fetchWithAuth(`/api/admin/creator-applications/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, adminNotes }),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Fehler beim Prüfen der Creator-Bewerbung');
    }
    return json.data;
  },

  async getAdminReports(status?: string): Promise<CommunityReport[]> {
    const qs = new URLSearchParams();
    if (status && status !== 'all') qs.set('status', status);
    const res = await fetchWithAuth(`/api/admin/reports?${qs.toString()}`);
    const json = await safeJson<{ success: boolean; data?: CommunityReport[] }>(res, { success: false, data: [] });
    return json.data || [];
  },

  async reviewReport(id: string, status: 'RESOLVED' | 'DISMISSED', reviewNotes?: string): Promise<CommunityReport> {
    const res = await fetchWithAuth(`/api/admin/reports/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, reviewNotes }),
    });
    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Fehler beim Bearbeiten der Meldung');
    }
    return json.data;
  },
};
