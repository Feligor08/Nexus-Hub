export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: 'GUEST' | 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';
  roles?: string[];
  avatar: string;
  bio: string;
  skills: string[];
  technologies: string[];
  badges: string[];
  githubUrl?: string;
  websiteUrl?: string;
  createdAt: string;
  status: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt?: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  shortDesc: string;
  description: string;
  category: 'Software' | 'DevOps' | 'GameServer' | 'AI & Automation' | 'Maker' | 'ITA Curriculum' | string;
  techStack: string[];
  coverImage?: string;
  coverMediaId?: string;
  galleryImages: string[];
  galleryMediaIds?: string[];
  githubUrl?: string;
  liveUrl?: string;
  demoUrl?: string;
  documentationUrl?: string;
  videoUrl?: string;
  status: ContentStatus | 'Aktiv' | 'In Entwicklung' | 'Produktion' | 'Geplant';
  visibility?: 'PUBLIC' | 'PRIVATE';
  problem?: string;
  solution?: string;
  goal?: string;
  result?: string;
  architecture?: string;
  caseStudyProblem?: string;
  caseStudySolution?: string;
  caseStudyLearnings?: string;
  keyFeatures: string[];
  authorId: string;
  featured: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDesc: string;
  description: string;
  price: number;
  currency: string;
  category: 'Software' | 'Developer Tools' | 'Templates' | 'Minecraft Mods' | 'Roblox Assets' | '3D Models & STL' | 'Tutorials' | string;
  images: string[];
  digitalProduct: boolean;
  fileFormat: string;
  fileSize: string;
  version: string;
  license: string;
  authorId: string;
  stock: number;
  featured: boolean;
  published: boolean;
  status?: ContentStatus;
  visibility?: 'PUBLIC' | 'PRIVATE';
  publishedAt?: string;
  mediaFileId?: string;
  coverMediaId?: string;
  galleryMediaIds?: string[];
  downloadMediaId?: string;
  tags?: string[];
  features?: string[];
  requirements?: string[];
  changelog?: string;
  metaTitle?: string;
  metaDescription?: string;
  demoFileUrl?: string;
  documentationUrl?: string;
  rating?: number;
  reviewsCount?: number;
  downloadUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  id?: string;
  productId: string;
  quantity: number;
  name?: string;
  price?: number;
  fileFormat?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  fileFormat?: string;
}

export interface Order {
  id: string;
  userId: string;
  customerEmail: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED' | 'NOT_REQUIRED';
  downloadToken: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername?: string;
  authorAvatar?: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  likes: number;
  views?: number;
  comments: Comment[];
  createdAt: string;
  status?: ContentStatus;
  publishedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type?: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalPosts: number;
  database: {
    connected: boolean;
    type: string;
    latencyMs?: number;
  };
  infrastructure: {
    server: string;
    dockerContainers: number;
    tailscale: string;
    nginxProxyManager: string;
  };
}

export interface CreatorStats {
  myProjectsCount: number;
  myProductsCount: number;
  myPostsCount: number;
  draftsCount: number;
  publishedCount: number;
  archivedCount: number;
  myOrdersCount: number;
  myRevenue: number;
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  username: string;
  details: string;
  ip: string;
  timestamp: string;
}

export interface DatabaseInfo {
  connected: boolean;
  type: string;
  host?: string;
  database?: string;
  latencyMs?: number;
  checkedAt?: string;
  error?: string;
}

export interface SystemHealthData {
  status: string;
  platform: string;
  database: DatabaseInfo;
  services: Record<string, string>;
  infrastructure: Record<string, string>;
  timestamp: string;
}

export interface MediaFile {
  id: string;
  ownerId: string;
  filename: string;
  originalName: string;
  storagePath: string;
  storageKey?: string;
  mimeType: string;
  fileSize: number;
  fileCategory: 'image' | 'file' | 'document' | '3d';
  createdAt: string;
}

export interface DownloadEntitlement {
  id: string;
  userId: string;
  productId: string;
  orderId: string;
  versionId?: string;
  productName: string;
  fileFormat: string;
  fileSize: string;
  version: string;
  createdAt: string;
}
