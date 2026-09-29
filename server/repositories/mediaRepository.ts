import { executeQuery, getLastDatabaseStatus, withTransaction } from '../config/database';
import { MediaFile } from '../models/types';

export class MediaRepository {
  private requireDatabase(): void {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Mediendaten sind derzeit nicht verfügbar.');
    }
  }

  async create(data: Omit<MediaFile, 'createdAt' | 'storagePath'>): Promise<MediaFile> {
    this.requireDatabase();
    const now = new Date().toISOString();
    const media: MediaFile = {
      ...data,
      storagePath: `/api/media/${encodeURIComponent(data.id)}/file`,
      createdAt: now,
    };

    await executeQuery(
      `INSERT INTO media_files (id, owner_id, filename, original_name, storage_path, storage_key, mime_type, file_size, file_category, created_at)
       VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, NOW())`,
      [media.id, media.ownerId, media.filename, media.originalName, media.storageKey || null, media.mimeType, media.fileSize, media.fileCategory]
    );
    return media;
  }

  async findAll(options?: { ownerId?: string; fileCategory?: string }): Promise<MediaFile[]> {
    this.requireDatabase();
    let sql = `SELECT * FROM media_files WHERE 1=1`;
    const params: any[] = [];
    if (options?.ownerId) {
      sql += ` AND owner_id = ?`;
      params.push(options.ownerId);
    }
    if (options?.fileCategory && options.fileCategory !== 'all') {
      sql += ` AND file_category = ?`;
      params.push(options.fileCategory);
    }
    sql += ` ORDER BY created_at DESC`;
    const rows = await executeQuery<any>(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id: string): Promise<MediaFile | null> {
    this.requireDatabase();
    const rows = await executeQuery<any>(`SELECT * FROM media_files WHERE id = ? LIMIT 1`, [id]);
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async delete(id: string, ownerId?: string): Promise<boolean> {
    this.requireDatabase();
    return withTransaction(async (connection) => {
      const whereOwner = ownerId ? ' AND owner_id = ?' : '';
      const [mediaRows] = await connection.execute<any[]>(
        `SELECT id FROM media_files WHERE id = ?${whereOwner} FOR UPDATE`,
        ownerId ? [id, ownerId] : [id]
      );
      if (!mediaRows.length) return false;
      const [referenceRows] = await connection.execute<any[]>(
        `SELECT
           EXISTS (SELECT 1 FROM projects WHERE cover_media_id = ?) OR
           EXISTS (SELECT 1 FROM project_media WHERE media_id = ?) OR
            EXISTS (SELECT 1 FROM products WHERE cover_media_id = ? OR download_media_id = ? OR media_file_id = ?) OR
            EXISTS (SELECT 1 FROM product_versions WHERE media_id = ?) OR
           EXISTS (SELECT 1 FROM product_media WHERE media_id = ?) AS is_referenced`,
          [id, id, id, id, id, id, id]
      );
      if (referenceRows[0]?.is_referenced) {
        const error = new Error('Datei wird noch von einem Projekt oder Produkt verwendet.') as Error & { code: string };
        error.code = 'MEDIA_REFERENCED';
        throw error;
      }
      const [result] = await connection.execute(`DELETE FROM media_files WHERE id = ?${whereOwner}`, ownerId ? [id, ownerId] : [id]);
      return (result as { affectedRows: number }).affectedRows > 0;
    });
  }

  async isPubliclyLinked(id: string): Promise<boolean> {
    this.requireDatabase();
    const rows = await executeQuery<any>(
      `SELECT
         EXISTS (SELECT 1 FROM projects WHERE cover_media_id = ? AND status = 'PUBLISHED' AND visibility = 'PUBLIC') OR
         EXISTS (SELECT 1 FROM project_media pm JOIN projects p ON p.id = pm.project_id WHERE pm.media_id = ? AND p.status = 'PUBLISHED' AND p.visibility = 'PUBLIC') OR
         EXISTS (SELECT 1 FROM products WHERE cover_media_id = ? AND status = 'PUBLISHED' AND visibility = 'PUBLIC') OR
         EXISTS (SELECT 1 FROM product_media pm JOIN products p ON p.id = pm.product_id WHERE pm.media_id = ? AND p.status = 'PUBLISHED' AND p.visibility = 'PUBLIC') AS is_public`,
      [id, id, id, id]
    );
    return Boolean(rows[0]?.is_public);
  }

  private mapRow(row: any): MediaFile {
    return {
      id: row.id,
      ownerId: row.owner_id,
      filename: row.filename,
      originalName: row.original_name,
      storageKey: row.storage_key || undefined,
      storagePath: `/api/media/${encodeURIComponent(row.id)}/file`,
      mimeType: row.mime_type,
      fileSize: Number(row.file_size),
      fileCategory: row.file_category,
      createdAt: row.created_at,
    };
  }
}

export const mediaRepository = new MediaRepository();
