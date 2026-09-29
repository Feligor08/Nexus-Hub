// Server-side in-memory relational store (Clean production fallback, MariaDB is primary)
export * from './models/types';
import {
  User,
  UserSession,
  Project,
  Product,
  CartItem,
  Order,
  Post,
  Notification,
  AuditLog,
  MediaFile,
  ProductVersion,
  DownloadEntitlement,
  DownloadToken,
} from './models/types';

// Database state - Strictly clean, ZERO demo data
class Database {
  cart: CartItem[] = [];
  sessions: UserSession[] = [];
  users: User[] = [];
  projects: Project[] = [];
  products: Product[] = [];
  orders: Order[] = [];
  posts: Post[] = [];
  notifications: Notification[] = [];
  auditLogs: AuditLog[] = [];
  media: MediaFile[] = [];
  productVersions: ProductVersion[] = [];
  entitlements: DownloadEntitlement[] = [];
  downloadTokens: DownloadToken[] = [];
}

export const db = new Database();
