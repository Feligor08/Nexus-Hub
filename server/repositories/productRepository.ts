import { randomUUID } from 'crypto';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { executeQuery, getLastDatabaseStatus, withTransaction } from '../config/database';
import { Product, ContentStatus } from '../models/types';

type SqlParameter = string | number | boolean | Date | null;

function parseStringArray(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('Ungültige Produktdaten in der Datenbank.');
  }
  return parsed;
}

export class ProductRepository {
  private requireDatabase(): void {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Produktdaten sind derzeit nicht verfügbar.');
    }
  }

  private async mapProduct(row: Record<string, any>): Promise<Product> {
    const galleryRows = await executeQuery<{ media_id: string }>(
      `SELECT media_id FROM product_media WHERE product_id = ? ORDER BY sort_order`,
      [row.id]
    );
    const coverMediaId = row.cover_media_id || row.media_file_id || undefined;
    const galleryMediaIds = galleryRows.map((galleryRow) => galleryRow.media_id);

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortDesc: row.short_description || '',
      description: row.description || '',
      price: Number(row.price),
      currency: row.currency || 'EUR',
      category: row.category_id,
      images: [coverMediaId, ...galleryMediaIds].filter(Boolean).map((id) => `/api/media/${encodeURIComponent(id)}/file`),
      coverMediaId,
      galleryMediaIds,
      downloadMediaId: row.download_media_id || undefined,
      tags: parseStringArray(row.tags),
      features: parseStringArray(row.features),
      requirements: parseStringArray(row.requirements),
      changelog: row.changelog || '',
      metaTitle: row.meta_title || '',
      metaDescription: row.meta_description || '',
      digitalProduct: Boolean(row.digital_product),
      fileFormat: row.file_format || 'ZIP',
      fileSize: row.file_size || '',
      version: row.version || '1.0.0',
      license: row.license || '',
      authorId: row.author_id,
      stock: Number(row.stock || 0),
      featured: Boolean(row.featured),
      published: row.status === 'PUBLISHED',
      status: row.status || 'DRAFT',
      visibility: row.visibility || 'PUBLIC',
      publishedAt: row.published_at,
      mediaFileId: row.media_file_id || undefined,
      demoFileUrl: row.demo_file_url || undefined,
      documentationUrl: row.documentation_url || undefined,
      rating: Number(row.rating || 0),
      reviewsCount: Number(row.reviews_count || 0),
      downloadUrl: '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async validateMediaReferences(
    connection: PoolConnection,
    product: Product,
    allowForeignOwner: boolean
  ): Promise<void> {
    const imageIds = [...new Set([product.coverMediaId, ...product.galleryMediaIds].filter((id): id is string => Boolean(id)))];
    const downloadIds = product.downloadMediaId ? [product.downloadMediaId] : [];

    for (const mediaId of [...imageIds, ...downloadIds]) {
      const [rows] = await connection.execute<Array<RowDataPacket & { owner_id: string; file_category: string }>>(
        `SELECT owner_id, file_category FROM media_files WHERE id = ? LIMIT 1 FOR UPDATE`,
        [mediaId]
      );
      const media = rows[0];
      if (!media || (!allowForeignOwner && media.owner_id !== product.authorId)) {
        throw new Error('Mediendatei nicht gefunden oder nicht im eigenen Besitz.');
      }
      if (imageIds.includes(mediaId) && media.file_category !== 'image') {
        throw new Error('Cover und Galerie dürfen nur Bilddateien referenzieren.');
      }
      if (downloadIds.includes(mediaId) && media.file_category === 'image') {
        throw new Error('Eine Bilddatei kann nicht als Download-Datei verwendet werden.');
      }
    }
  }

  async findAll(options?: {
    category?: string;
    search?: string;
    featured?: boolean;
    status?: ContentStatus | string;
    visibility?: 'PUBLIC' | 'PRIVATE';
    authorId?: string;
    includeDrafts?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ products: Product[]; total: number }> {
    this.requireDatabase();
    const targetStatus = options?.status || (options?.includeDrafts ? undefined : 'PUBLISHED');
    const targetVisibility = options?.visibility || (options?.includeDrafts ? undefined : 'PUBLIC');
    const conditions = ['1=1'];
    const params: unknown[] = [];
    if (targetStatus && targetStatus !== 'all') {
      conditions.push('status = ?');
      params.push(targetStatus);
    }
    if (targetVisibility) {
      conditions.push('visibility = ?');
      params.push(targetVisibility);
    }
    if (options?.authorId) {
      conditions.push('author_id = ?');
      params.push(options.authorId);
    }
    if (options?.category && options.category !== 'all') {
      conditions.push('category_id = ?');
      params.push(options.category);
    }
    if (options?.featured !== undefined) {
      conditions.push('featured = ?');
      params.push(options.featured ? 1 : 0);
    }
    if (options?.search) {
      conditions.push('(name LIKE ? OR short_description LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    const where = conditions.join(' AND ');
    const countRows = await executeQuery<{ total: number }>(`SELECT COUNT(*) AS total FROM products WHERE ${where}`, params);
    const limit = Math.min(Math.max(options?.limit || 24, 1), 100);
    const offset = (Math.max(options?.page || 1, 1) - 1) * limit;
    const rows = await executeQuery<Record<string, any>>(
      `SELECT * FROM products WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { products: await Promise.all(rows.map((row) => this.mapProduct(row))), total: Number(countRows[0]?.total || 0) };
  }

  async findBySlug(slug: string): Promise<Product | null> {
    this.requireDatabase();
    const rows = await executeQuery<Record<string, any>>(`SELECT * FROM products WHERE slug = ? LIMIT 1`, [slug]);
    return rows.length > 0 ? this.mapProduct(rows[0]) : null;
  }

  async findById(id: string): Promise<Product | null> {
    this.requireDatabase();
    const rows = await executeQuery<Record<string, any>>(`SELECT * FROM products WHERE id = ? LIMIT 1`, [id]);
    return rows.length > 0 ? this.mapProduct(rows[0]) : null;
  }

  async create(data: Partial<Product>, allowForeignMedia = false): Promise<Product> {
    this.requireDatabase();
    if (!data.authorId || !data.name?.trim() || !data.slug?.trim()) {
      throw new Error('Produkt, Slug und serverseitige Autor-ID sind erforderlich.');
    }
    const id = randomUUID();
    const slug = data.slug;
    const now = new Date().toISOString();
    const status = data.status || 'DRAFT';
    const publishedAt = status === 'PUBLISHED' ? now : undefined;

    const newProd: Product = {
      id,
      slug,
      name: data.name.trim(),
      shortDesc: data.shortDesc || '',
      description: data.description || '',
      price: data.price || 0,
      currency: data.currency || 'EUR',
      category: data.category || 'Developer Tools',
      images: [],
      coverMediaId: data.coverMediaId,
      galleryMediaIds: data.galleryMediaIds || [],
      downloadMediaId: data.downloadMediaId,
      tags: data.tags || [],
      features: data.features || [],
      requirements: data.requirements || [],
      changelog: data.changelog || '',
      metaTitle: data.metaTitle || '',
      metaDescription: data.metaDescription || '',
      digitalProduct: data.digitalProduct !== undefined ? data.digitalProduct : true,
      fileFormat: data.fileFormat || 'ZIP',
      fileSize: data.fileSize || '15 MB',
      version: data.version || '1.0.0',
      license: data.license || 'MIT / Commercial',
      authorId: data.authorId,
      stock: data.stock !== undefined ? data.stock : 0,
      featured: Boolean(data.featured),
      published: status === 'PUBLISHED',
      status,
      visibility: data.visibility || 'PUBLIC',
      publishedAt,
      mediaFileId: data.mediaFileId,
      demoFileUrl: data.demoFileUrl,
      documentationUrl: data.documentationUrl,
      rating: data.rating !== undefined ? data.rating : 0,
      reviewsCount: data.reviewsCount !== undefined ? data.reviewsCount : 0,
      downloadUrl: '',
      createdAt: now,
      updatedAt: now,
    };

    newProd.images = [newProd.coverMediaId, ...newProd.galleryMediaIds]
      .filter((mediaId): mediaId is string => Boolean(mediaId))
      .map((mediaId) => `/api/media/${encodeURIComponent(mediaId)}/file`);

    await withTransaction(async (connection) => {
      await this.validateMediaReferences(connection, newProd, allowForeignMedia);
      const insertValues: SqlParameter[] = [
        newProd.id, newProd.slug, newProd.name, newProd.shortDesc, newProd.description,
        newProd.price, newProd.currency, newProd.category, newProd.digitalProduct ? 1 : 0,
        newProd.fileFormat, newProd.fileSize, newProd.version, newProd.license, newProd.authorId,
        newProd.stock, newProd.featured ? 1 : 0, newProd.published ? 1 : 0, status,
        newProd.visibility || 'PUBLIC', publishedAt ? new Date(publishedAt) : null,
        newProd.mediaFileId || null, newProd.demoFileUrl || null, newProd.documentationUrl || null,
        newProd.rating, newProd.reviewsCount, null, JSON.stringify(newProd.tags) || '[]',
        JSON.stringify(newProd.features) || '[]', JSON.stringify(newProd.requirements) || '[]',
        newProd.changelog || null, newProd.metaTitle || null, newProd.metaDescription || null,
        newProd.coverMediaId || null, newProd.downloadMediaId || null,
      ];
      await connection.execute(
        `INSERT INTO products (id, slug, name, short_description, description, price, currency, category_id, digital_product, file_format, file_size, version, license, author_id, stock, featured, published, status, visibility, published_at, media_file_id, demo_file_url, documentation_url, rating, reviews_count, download_url, tags, features, requirements, changelog, meta_title, meta_description, cover_media_id, download_media_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        insertValues
      );
      for (const [sortOrder, mediaId] of newProd.galleryMediaIds.entries()) {
        await connection.execute(
          `INSERT INTO product_media (product_id, media_id, sort_order) VALUES (?, ?, ?)`,
          [newProd.id, mediaId, sortOrder]
        );
      }
    });
    return newProd;
  }

  async update(id: string, data: Partial<Product>, authorId?: string, allowForeignMedia = false): Promise<Product | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    if (authorId && existing.authorId !== authorId) {
      return null; // Ownership check
    }

    const now = new Date().toISOString();
    const updated: Product = {
      ...existing,
      ...data,
      id: existing.id,
      authorId: existing.authorId,
      createdAt: existing.createdAt,
      updatedAt: now,
      publishedAt:
        data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED'
          ? now
          : existing.publishedAt,
    };
            const updatedStatus = updated.status || 'DRAFT';

    updated.images = [updated.coverMediaId, ...updated.galleryMediaIds]
      .filter((mediaId): mediaId is string => Boolean(mediaId))
      .map((mediaId) => `/api/media/${encodeURIComponent(mediaId)}/file`);

    await withTransaction(async (connection) => {
      await this.validateMediaReferences(connection, updated, allowForeignMedia);
      const ownershipClause = authorId ? ' AND author_id = ?' : '';
      const updateValues: SqlParameter[] = [
        updated.name, updated.slug, updated.shortDesc, updated.description, updated.price,
        updated.category, updated.digitalProduct ? 1 : 0, updated.fileFormat, updated.fileSize,
        updated.version, updated.license, updated.stock, updated.featured ? 1 : 0,
        updatedStatus === 'PUBLISHED' ? 1 : 0, updatedStatus, updated.visibility || 'PUBLIC',
        updated.publishedAt ? new Date(updated.publishedAt) : null, updated.mediaFileId || null,
        updated.demoFileUrl || null, updated.documentationUrl || null,
        JSON.stringify(updated.tags) || '[]', JSON.stringify(updated.features) || '[]',
        JSON.stringify(updated.requirements) || '[]', updated.changelog || null,
        updated.metaTitle || null, updated.metaDescription || null,
        updated.coverMediaId || null, updated.downloadMediaId || null, id,
      ];
      if (authorId) updateValues.push(authorId);
      await connection.execute(
        `UPDATE products SET
            name = ?, slug = ?, short_description = ?, description = ?, price = ?,
            category_id = ?, digital_product = ?, file_format = ?, file_size = ?,
            version = ?, license = ?, stock = ?, featured = ?, published = ?, status = ?,
            visibility = ?, published_at = ?, media_file_id = ?, demo_file_url = ?, documentation_url = ?,
            tags = ?, features = ?, requirements = ?, changelog = ?, meta_title = ?, meta_description = ?,
            cover_media_id = ?, download_media_id = ?,
            updated_at = NOW()
           WHERE id = ?${ownershipClause}`,
        updateValues
      );

      if (data.galleryMediaIds !== undefined) {
        await connection.execute(`DELETE FROM product_media WHERE product_id = ?`, [id]);
        for (const [sortOrder, mediaId] of updated.galleryMediaIds.entries()) {
          await connection.execute(
            `INSERT INTO product_media (product_id, media_id, sort_order) VALUES (?, ?, ?)`,
            [id, mediaId, sortOrder]
          );
        }
      }
    });
    return updated;
  }

  async delete(id: string, authorId?: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    if (authorId && existing.authorId !== authorId) {
      return false; // Ownership check
    }

    this.requireDatabase();
    const ownershipClause = authorId ? ' AND author_id = ?' : '';
    const [result] = await withTransaction(async (connection) => connection.execute(
      `DELETE FROM products WHERE id = ?${ownershipClause}`,
      authorId ? [id, authorId] : [id]
    ));
    return (result as { affectedRows: number }).affectedRows > 0;
  }
}

export const productRepository = new ProductRepository();
