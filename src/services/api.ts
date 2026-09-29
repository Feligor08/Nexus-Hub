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

export const api = {
  // Database & Health Checks (Sections 10, 11, 31)
  async getHealth(): Promise<any> {
    const res = await fetchWithAuth('/api/health');
    return res.json();
  },

  async getDatabaseHealth(): Promise<{ success: boolean; database: DatabaseInfo }> {
    const res = await fetchWithAuth('/api/health/database');
    return res.json();
  },

  async getSystemHealth(): Promise<SystemHealthData> {
    const res = await fetchWithAuth('/api/admin/system-health');
    const json = await res.json();
    return json.data;
  },

  async runDatabaseMigrations(): Promise<any> {
    const res = await fetchWithAuth('/api/database/migrate', {
      method: 'POST',
    });
    return res.json();
  },

  // Real Authentication (Sprint 2.0)
  async getMe(): Promise<{ authenticated: boolean; user: User | null }> {
    const res = await fetchWithAuth('/api/auth/me');
    const json = await res.json();
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
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Registrierung fehlgeschlagen');
    }
    if (json.token) {
      setSessionToken(json.token);
    }
    return json;
  },

  async login(data: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; authenticated: boolean; user: User; token: string }> {
    const res = await fetchWithAuth('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Ungültige Anmeldedaten');
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
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Fehler beim Aktualisieren des Profils');
    }
    return json.user || json.data;
  },

  async switchRole(role: string): Promise<User> {
    const res = await fetchWithAuth('/api/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (json.token) {
      setSessionToken(json.token);
    }
    return json.user || json.data;
  },

  async getUserByUsername(username: string): Promise<User> {
    const res = await fetchWithAuth(`/api/users/${encodeURIComponent(username)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Benutzer nicht gefunden');
    return json.data;
  },

  // Projects / Portfolio
  async getProjects(category?: string, search?: string): Promise<Project[]> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search) params.set('search', search);

    const res = await fetchWithAuth(`/api/projects?${params.toString()}`);
    const json = await res.json();
    return json.data || [];
  },

  async getFeaturedProjects(): Promise<Project[]> {
    const res = await fetchWithAuth('/api/projects/featured');
    const json = await res.json();
    return json.data || [];
  },

  async getProjectBySlug(slug: string): Promise<Project> {
    const res = await fetchWithAuth(`/api/projects/${encodeURIComponent(slug)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Projekt nicht gefunden');
    return json.data;
  },

  async createProject(projectData: Partial<Project>): Promise<Project> {
    const res = await fetchWithAuth('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Erstellen des Projekts');
    return json.data;
  },

  async updateProject(id: string, projectData: Partial<Project>): Promise<Project> {
    const res = await fetchWithAuth(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Aktualisieren des Projekts');
    return json.data;
  },

  async updateProjectStatus(id: string, status: string): Promise<Project> {
    const res = await fetchWithAuth(`/api/projects/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Ändern des Projekt-Status');
    return json.data;
  },

  async deleteProject(id: string): Promise<void> {
    const res = await fetchWithAuth(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
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
    const json = await res.json();
    return json.data || [];
  },

  async getProductBySlug(slug: string): Promise<Product> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(slug)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Produkt nicht gefunden');
    return json.data;
  },

  async createProduct(productData: Partial<Product>): Promise<Product> {
    const res = await fetchWithAuth('/api/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Erstellen des Produkts');
    return json.data;
  },

  async updateProduct(id: string, productData: Partial<Product>): Promise<Product> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Aktualisieren des Produkts');
    return json.data;
  },

  async updateProductStatus(id: string, status: string): Promise<Product> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Ändern des Produkt-Status');
    return json.data;
  },

  async deleteProduct(id: string): Promise<void> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Löschen des Produkts');
  },

  async claimFreeProduct(id: string): Promise<{ order: Order; entitlement: DownloadEntitlement; downloadToken: string; expiresAt: string }> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}/claim-free`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Kostenloses Produkt konnte nicht aktiviert werden');
    return json.data;
  },

  async getProductVersions(productId: string): Promise<any[]> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(productId)}/versions`);
    const json = await res.json();
    return json.data || [];
  },

  async createProductVersion(productId: string, versionData: { version: string; releaseNotes?: string; mediaId?: string }): Promise<any> {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(productId)}/versions`, {
      method: 'POST',
      body: JSON.stringify(versionData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Anlegen der Version');
    return json.data;
  },

  // Media Management
  async getMedia(all = false, category?: string): Promise<MediaFile[]> {
    const params = new URLSearchParams();
    if (all) params.set('all', 'true');
    if (category && category !== 'all') params.set('category', category);
    const res = await fetchWithAuth(`/api/media?${params.toString()}`);
    const json = await res.json();
    return json.data || [];
  },

  async uploadMedia(mediaData: { filename: string; originalName?: string; storagePath?: string; mimeType?: string; fileSize?: number; fileCategory?: 'image' | 'file' | 'document' | '3d' }): Promise<MediaFile> {
    const res = await fetchWithAuth('/api/media', {
      method: 'POST',
      body: JSON.stringify(mediaData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Hochladen der Mediendatei');
    return json.data;
  },

  async deleteMedia(id: string): Promise<void> {
    const res = await fetchWithAuth(`/api/media/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Löschen der Mediendatei');
  },

  // Downloads & Entitlements
  async getEntitlements(): Promise<DownloadEntitlement[]> {
    const res = await fetchWithAuth('/api/downloads/entitlements');
    const json = await res.json();
    return json.data || [];
  },

  async getDownloadToken(entitlementId: string): Promise<{ token: string; expiresAt: string; downloadUrl: string }> {
    const res = await fetchWithAuth(`/api/downloads/token/${encodeURIComponent(entitlementId)}`, {
      method: 'POST',
    });
    const json = await res.json();
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
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Abrufen der CMS-Statistiken');
    return json.data;
  },

  // Cart
  async getCart(): Promise<any[]> {
    const res = await fetchWithAuth('/api/cart');
    const json = await res.json();
    return json.data || [];
  },

  async addToCart(productId: string, quantity = 1): Promise<any[]> {
    const res = await fetchWithAuth('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
    const json = await res.json();
    return json.data;
  },

  async removeFromCart(productId: string): Promise<any[]> {
    const res = await fetchWithAuth(`/api/cart/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    return json.data;
  },

  async clearCart(): Promise<void> {
    await fetchWithAuth('/api/cart/clear', { method: 'POST' });
  },

  async checkout(): Promise<Order> {
    const res = await fetchWithAuth('/api/checkout', {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Checkout fehlgeschlagen');
    return json.data;
  },

  async getOrders(): Promise<Order[]> {
    const res = await fetchWithAuth('/api/orders');
    const json = await res.json();
    return json.data || [];
  },

  // Community
  async getPosts(category?: string): Promise<Post[]> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);

    const res = await fetchWithAuth(`/api/community/posts?${params.toString()}`);
    const json = await res.json();
    return json.data || [];
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
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Erstellen des Beitrags');
    return json.data;
  },

  async likePost(postId: string): Promise<number> {
    const res = await fetchWithAuth(`/api/community/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
    });
    const json = await res.json();
    return json.data.likes;
  },

  async addComment(postId: string, content: string): Promise<any> {
    const res = await fetchWithAuth(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    const json = await res.json();
    return json.data;
  },

  async deletePost(postId: string): Promise<void> {
    const res = await fetchWithAuth(`/api/community/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Löschen des Beitrags');
  },

  async deleteComment(postId: string, commentId: string): Promise<void> {
    const res = await fetchWithAuth(
      `/api/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE' }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Löschen des Kommentars');
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const res = await fetchWithAuth('/api/notifications');
    const json = await res.json();
    return json.data || [];
  },

  async markAllNotificationsRead(): Promise<void> {
    await fetchWithAuth('/api/notifications/read-all', { method: 'POST' });
  },

  // Admin & Governance
  async getAdminStats(): Promise<AdminStats> {
    const res = await fetchWithAuth('/api/admin/stats');
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Zugriff verweigert');
    return json.data;
  },

  async getAdminUsers(): Promise<User[]> {
    const res = await fetchWithAuth('/api/admin/users');
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Zugriff verweigert');
    return json.data;
  },

  async updateAdminUserRole(userId: string, role: string): Promise<User> {
    const res = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Aktualisieren der Rolle');
    return json.data;
  },

  async toggleAdminUserStatus(userId: string): Promise<User> {
    const res = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Fehler beim Umschalten des Status');
    return json.data;
  },

  async getAdminAuditLogs(): Promise<AuditLog[]> {
    const res = await fetchWithAuth('/api/admin/audit-logs');
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Zugriff verweigert');
    return json.data;
  },
};
