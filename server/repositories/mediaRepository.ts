import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { MediaFile } from '../models/types';
import { db } from '../db';

export class MediaRepository {
  async create(data: Omit<MediaFile, 'createdAt'>): Promise<MediaFile> {
    const now = new Date().toISOString();
    const media: MediaFile = {
      ...data,
      createdAt: now,
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO media_files (id, owner_id, filename, original_name, storage_path, mime_type, file_size, file_category, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            media.id,
            media.ownerId,
            media.filename,
            media.originalName,
            media.storagePath,
            media.mimeType,
            media.fileSize,
            media.fileCategory,
          ]
        );
      } catch (err) {
        console.warn('MariaDB media_files insert failed:', err);
      }
    }

    db.media.unshift(media);
    return media;
  }

  async findAll(options?: { ownerId?: string; fileCategory?: string }): Promise<MediaFile[]> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
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

        return rows.map((r) => ({
          id: r.id,
          ownerId: r.owner_id,
          filename: r.filename,
          originalName: r.original_name,
          storagePath: r.storage_path,
          mimeType: r.mime_type,
          fileSize: r.file_size,
          fileCategory: r.file_category,
          createdAt: r.created_at,
        }));
      } catch (err) {
        console.warn('MariaDB media_files query failed:', err);
      }
    }

    let list = [...db.media];
    if (options?.ownerId) list = list.filter((m) => m.ownerId === options.ownerId);
    if (options?.fileCategory && options.fileCategory !== 'all') {
      list = list.filter((m) => m.fileCategory === options.fileCategory);
    }
    return list;
  }

  async findById(id: string): Promise<MediaFile | null> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(`SELECT * FROM media_files WHERE id = ? LIMIT 1`, [id]);
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            ownerId: r.owner_id,
            filename: r.filename,
            originalName: r.original_name,
            storagePath: r.storage_path,
            mimeType: r.mime_type,
            fileSize: r.file_size,
            fileCategory: r.file_category,
            createdAt: r.created_at,
          };
        }
      } catch (err) {
        console.warn('MariaDB media_files findById failed:', err);
      }
    }
    return db.media.find((m) => m.id === id) || null;
  }

  async delete(id: string, ownerId?: string): Promise<boolean> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        let sql = `DELETE FROM media_files WHERE id = ?`;
        const params: any[] = [id];
        if (ownerId) {
          sql += ` AND owner_id = ?`;
          params.push(ownerId);
        }
        await executeQuery(sql, params);
      } catch (err) {
        console.warn('MariaDB media_files delete failed:', err);
      }
    }

    const idx = db.media.findIndex((m) => m.id === id && (!ownerId || m.ownerId === ownerId));
    if (idx >= 0) {
      db.media.splice(idx, 1);
      return true;
    }
    return false;
  }
}

export const mediaRepository = new MediaRepository();
