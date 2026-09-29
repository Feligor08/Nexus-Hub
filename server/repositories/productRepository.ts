import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { Product, ContentStatus } from '../models/types';
import { db } from '../db';

export class ProductRepository {
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
    const dbStatus = getLastDatabaseStatus();

    const targetStatus = options?.status || (options?.includeDrafts ? undefined : 'PUBLISHED');
    const targetVisibility = options?.visibility || (options?.includeDrafts ? undefined : 'PUBLIC');

    if (dbStatus.connected) {
      try {
        let sql = `SELECT * FROM products WHERE 1=1`;
        const params: any[] = [];

        if (targetStatus && targetStatus !== 'all') {
          sql += ` AND status = ?`;
          params.push(targetStatus);
        }

        if (targetVisibility) {
          sql += ` AND (visibility = ? OR visibility IS NULL)`;
          params.push(targetVisibility);
        }

        if (options?.authorId) {
          sql += ` AND author_id = ?`;
          params.push(options.authorId);
        }

        if (options?.category && options.category !== 'all') {
          sql += ` AND category_id = ?`;
          params.push(options.category);
        }

        if (options?.featured !== undefined) {
          sql += ` AND featured = ?`;
          params.push(options.featured ? 1 : 0);
        }

        if (options?.search) {
          sql += ` AND (name LIKE ? OR short_description LIKE ?)`;
          const term = `%${options.search}%`;
          params.push(term, term);
        }

        sql += ` ORDER BY created_at DESC`;

        const limit = Math.min(options?.limit || 24, 100);
        const offset = ((options?.page || 1) - 1) * limit;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rows = await executeQuery<any>(sql, params);

        const products: Product[] = rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          shortDesc: r.short_description || '',
          description: r.description || '',
          price: Number(r.price),
          currency: r.currency || 'EUR',
          category: r.category_id as any,
          images: [],
          digitalProduct: Boolean(r.digital_product),
          fileFormat: r.file_format || 'ZIP',
          fileSize: r.file_size || '10 MB',
          version: r.version || '1.0.0',
          license: r.license || 'MIT / Commercial',
          authorId: r.author_id,
          stock: r.stock !== undefined ? r.stock : 999,
          featured: Boolean(r.featured),
          published: r.status === 'PUBLISHED' || Boolean(r.published),
          status: r.status || (r.published ? 'PUBLISHED' : 'DRAFT'),
          visibility: r.visibility || 'PUBLIC',
          publishedAt: r.published_at,
          mediaFileId: r.media_file_id,
          demoFileUrl: r.demo_file_url,
          documentationUrl: r.documentation_url,
          rating: Number(r.rating || 5.0),
          reviewsCount: r.reviews_count || 1,
          downloadUrl: r.download_url || '',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));

        return { products, total: products.length };
      } catch (err) {
        console.warn('MariaDB query failed in productRepository:', err);
      }
    }

    let list = [...db.products];

    if (targetStatus && targetStatus !== 'all') {
      list = list.filter((p) => (p.status || (p.published ? 'PUBLISHED' : 'DRAFT')) === targetStatus);
    }
    if (targetVisibility) {
      list = list.filter((p) => (p.visibility || 'PUBLIC') === targetVisibility);
    }
    if (options?.authorId) {
      list = list.filter((p) => p.authorId === options.authorId);
    }
    if (options?.category && options.category !== 'all') {
      list = list.filter((p) => p.category === options.category);
    }
    if (options?.featured !== undefined) {
      list = list.filter((p) => p.featured === options.featured);
    }
    if (options?.search) {
      const s = options.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.shortDesc.toLowerCase().includes(s)
      );
    }

    const total = list.length;
    const limit = options?.limit || 24;
    const page = options?.page || 1;
    const paginated = list.slice((page - 1) * limit, page * limit);

    return { products: paginated, total };
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(`SELECT * FROM products WHERE slug = ? LIMIT 1`, [slug]);
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            slug: r.slug,
            name: r.name,
            shortDesc: r.short_description || '',
            description: r.description || '',
            price: Number(r.price),
            currency: r.currency || 'EUR',
            category: r.category_id as any,
            images: [],
            digitalProduct: Boolean(r.digital_product),
            fileFormat: r.file_format || 'ZIP',
            fileSize: r.file_size || '10 MB',
            version: r.version || '1.0.0',
            license: r.license || 'MIT / Commercial',
            authorId: r.author_id,
            stock: r.stock !== undefined ? r.stock : 999,
            featured: Boolean(r.featured),
            published: r.status === 'PUBLISHED' || Boolean(r.published),
            status: r.status || (r.published ? 'PUBLISHED' : 'DRAFT'),
            visibility: r.visibility || 'PUBLIC',
            publishedAt: r.published_at,
            mediaFileId: r.media_file_id,
            demoFileUrl: r.demo_file_url,
            documentationUrl: r.documentation_url,
            rating: Number(r.rating || 5.0),
            reviewsCount: r.reviews_count || 1,
            downloadUrl: r.download_url || '',
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          };
        }
      } catch (err) {
        console.warn('MariaDB query failed in productRepository.findBySlug:', err);
      }
    }

    return db.products.find((p) => p.slug === slug) || null;
  }

  async findById(id: string): Promise<Product | null> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(`SELECT slug FROM products WHERE id = ? LIMIT 1`, [id]);
        if (rows.length > 0) {
          return this.findBySlug(rows[0].slug);
        }
      } catch (err) {
        console.warn('MariaDB query failed in productRepository.findById:', err);
      }
    }
    return db.products.find((p) => p.id === id) || null;
  }

  async create(data: Partial<Product>): Promise<Product> {
    const id = data.id || `prod-${Date.now()}`;
    const slug = data.slug || (data.name ? data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : id);
    const now = new Date().toISOString();
    const status = data.status || 'DRAFT';
    const publishedAt = status === 'PUBLISHED' ? now : undefined;

    const newProd: Product = {
      id,
      slug,
      name: data.name || 'Neues Produkt',
      shortDesc: data.shortDesc || '',
      description: data.description || '',
      price: data.price || 0,
      currency: data.currency || 'EUR',
      category: data.category || 'Developer Tools',
      images: data.images || ['/src/assets/images/nexus_cyberpunk_banner_1790662130550.jpg'],
      digitalProduct: data.digitalProduct !== undefined ? data.digitalProduct : true,
      fileFormat: data.fileFormat || 'ZIP',
      fileSize: data.fileSize || '15 MB',
      version: data.version || '1.0.0',
      license: data.license || 'MIT / Commercial',
      authorId: data.authorId || 'anonymous',
      stock: data.stock !== undefined ? data.stock : 999,
      featured: Boolean(data.featured),
      published: status === 'PUBLISHED',
      status,
      visibility: data.visibility || 'PUBLIC',
      publishedAt,
      mediaFileId: data.mediaFileId,
      demoFileUrl: data.demoFileUrl,
      documentationUrl: data.documentationUrl,
      rating: data.rating !== undefined ? data.rating : 5.0,
      reviewsCount: data.reviewsCount !== undefined ? data.reviewsCount : 0,
      downloadUrl: data.downloadUrl || '',
      createdAt: now,
      updatedAt: now,
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO products (id, slug, name, short_description, description, price, currency, category_id, digital_product, file_format, file_size, version, license, author_id, stock, featured, published, status, visibility, published_at, media_file_id, demo_file_url, documentation_url, rating, reviews_count, download_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            newProd.id,
            newProd.slug,
            newProd.name,
            newProd.shortDesc,
            newProd.description,
            newProd.price,
            newProd.currency,
            newProd.category,
            newProd.digitalProduct ? 1 : 0,
            newProd.fileFormat,
            newProd.fileSize,
            newProd.version,
            newProd.license,
            newProd.authorId,
            newProd.stock,
            newProd.featured ? 1 : 0,
            newProd.published ? 1 : 0,
            newProd.status,
            newProd.visibility || 'PUBLIC',
            publishedAt ? new Date(publishedAt) : null,
            newProd.mediaFileId || null,
            newProd.demoFileUrl || null,
            newProd.documentationUrl || null,
            newProd.rating,
            newProd.reviewsCount,
            newProd.downloadUrl,
          ]
        );
      } catch (err) {
        console.warn('MariaDB create product failed:', err);
      }
    }

    db.products.unshift(newProd);
    return newProd;
  }

  async update(id: string, data: Partial<Product>, authorId?: string): Promise<Product | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    if (authorId && existing.authorId !== authorId) {
      return null; // Ownership check
    }

    const now = new Date().toISOString();
    const updated: Product = {
      ...existing,
      ...data,
      updatedAt: now,
      publishedAt:
        data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED'
          ? now
          : existing.publishedAt,
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `UPDATE products SET
            name = ?, slug = ?, short_description = ?, description = ?, price = ?,
            category_id = ?, digital_product = ?, file_format = ?, file_size = ?,
            version = ?, license = ?, stock = ?, featured = ?, published = ?, status = ?,
            visibility = ?, published_at = ?, media_file_id = ?, demo_file_url = ?, documentation_url = ?,
            updated_at = NOW()
           WHERE id = ?`,
          [
            updated.name,
            updated.slug,
            updated.shortDesc,
            updated.description,
            updated.price,
            updated.category,
            updated.digitalProduct ? 1 : 0,
            updated.fileFormat,
            updated.fileSize,
            updated.version,
            updated.license,
            updated.stock,
            updated.featured ? 1 : 0,
            updated.status === 'PUBLISHED' ? 1 : 0,
            updated.status,
            updated.visibility || 'PUBLIC',
            updated.publishedAt ? new Date(updated.publishedAt) : null,
            updated.mediaFileId || null,
            updated.demoFileUrl || null,
            updated.documentationUrl || null,
            id,
          ]
        );
      } catch (err) {
        console.warn('MariaDB update product failed:', err);
      }
    }

    const idx = db.products.findIndex((p) => p.id === id);
    if (idx >= 0) {
      db.products[idx] = updated;
    }
    return updated;
  }

  async delete(id: string, authorId?: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    if (authorId && existing.authorId !== authorId) {
      return false; // Ownership check
    }

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`DELETE FROM products WHERE id = ?`, [id]);
      } catch (err) {
        console.warn('MariaDB delete product failed:', err);
      }
    }

    const idx = db.products.findIndex((p) => p.id === id);
    if (idx >= 0) {
      db.products.splice(idx, 1);
      return true;
    }
    return false;
  }
}

export const productRepository = new ProductRepository();
