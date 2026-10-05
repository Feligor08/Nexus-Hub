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
  website?: string;
  location?: string;
  createdAt: string;
  status: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt?: string;
  passwordHash?: string;
}

export interface CreatorApplication {
  id: string;
  userId: string;
  userUsername?: string;
  userEmail?: string;
  userDisplayName?: string;
  portfolioUrl?: string;
  motivation: string;
  plannedProjects: string;
  plannedContent: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  tokenHash: string;
  token?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  createdAt: string;
}

export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Project {
  id: string;
  slug: string;
  title: string;
  shortDesc: string;
  description: string;
  category: 'Software' | 'DevOps' | 'GameServer' | 'AI & Automation' | 'Maker' | 'ITA Curriculum' | string;
  techStack: string[];
  coverImage?: string;
  galleryImages: string[];
  githubUrl?: string;
  liveUrl?: string;
  demoUrl?: string;
  documentationUrl?: string;
  videoUrl?: string;
  status: ContentStatus | 'Aktiv' | 'In Entwicklung' | 'Produktion' | 'Geplant';
  visibility?: 'PUBLIC' | 'PRIVATE';
  problem?: string;
  solution?: string;
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
  demoFileUrl?: string;
  documentationUrl?: string;
  rating: number;
  reviewsCount: number;
  downloadUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
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
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED' | 'ORDER_CREATED';
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

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  username: string;
  details: string;
  ip: string;
  timestamp: string;
}

export interface AiConversation {
  id: string;
  userId: string;
  title: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string;
  createdAt: string;
}

export interface ApiEndpointLog {
  id: string;
  endpoint: string;
  service: string;
  statusCode: number;
  responseTimeMs: number;
  status: 'OPTIMAL' | 'DEGRADED' | 'DOWN';
  checkedAt: string;
}

export interface MediaFile {
  id: string;
  ownerId: string;
  filename: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  fileCategory: 'image' | 'file' | 'document' | '3d';
  createdAt: string;
}

export interface ProductVersion {
  id: string;
  productId: string;
  version: string;
  releaseNotes?: string;
  mediaId?: string;
  createdAt: string;
}

export interface DownloadEntitlement {
  id: string;
  userId: string;
  productId: string;
  orderId: string;
  versionId?: string;
  createdAt: string;
  productName?: string;
  fileFormat?: string;
  fileSize?: string;
}

export interface DownloadToken {
  id: string;
  entitlementId: string;
  userId: string;
  tokenHash: string;
  token?: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}
