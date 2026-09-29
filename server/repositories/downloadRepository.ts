import crypto from 'crypto';
import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { DownloadEntitlement, DownloadToken, Product } from '../models/types';
import { db } from '../db';
import { productRepository } from './productRepository';

export class DownloadRepository {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createEntitlement(
    userId: string,
    productId: string,
    orderId: string,
    versionId?: string
  ): Promise<DownloadEntitlement> {
    const id = `ent-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const entitlement: DownloadEntitlement = {
      id,
      userId,
      productId,
      orderId,
      versionId,
      createdAt: now,
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO download_entitlements (id, user_id, product_id, order_id, version_id, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [id, userId, productId, orderId, versionId || null]
        );
      } catch (err) {
        console.warn('MariaDB download_entitlements insert failed:', err);
      }
    }

    db.entitlements.unshift(entitlement);
    return entitlement;
  }

  async getUserEntitlements(userId: string): Promise<DownloadEntitlement[]> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT de.*, p.name as product_name, p.file_format, p.file_size, p.version
           FROM download_entitlements de
           JOIN products p ON de.product_id = p.id
           WHERE de.user_id = ?
           ORDER BY de.created_at DESC`,
          [userId]
        );

        return rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          productId: r.product_id,
          orderId: r.order_id,
          versionId: r.version_id,
          productName: r.product_name,
          fileFormat: r.file_format,
          fileSize: r.file_size,
          version: r.version,
          createdAt: r.created_at,
        }));
      } catch (err) {
        console.warn('MariaDB download_entitlements query failed:', err);
      }
    }

    const userEnts = db.entitlements.filter((e) => e.userId === userId);
    return userEnts.map((e) => {
      const prod = db.products.find((p) => p.id === e.productId);
      return {
        ...e,
        productName: prod?.name || 'Digitales Produkt',
        fileFormat: prod?.fileFormat || 'ZIP',
        fileSize: prod?.fileSize || '10 MB',
        version: prod?.version || '1.0.0',
      };
    });
  }

  async createDownloadToken(
    entitlementId: string,
    userId: string,
    ttlHours: number = 24
  ): Promise<{ token: string; expiresAt: string }> {
    const rawToken = `dl-${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = this.hashToken(rawToken);
    const id = `tok-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
    const now = new Date().toISOString();

    const dt: DownloadToken = {
      id,
      entitlementId,
      userId,
      tokenHash,
      token: rawToken,
      expiresAt,
      createdAt: now,
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO download_tokens (id, entitlement_id, user_id, token_hash, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [id, entitlementId, userId, tokenHash, new Date(expiresAt)]
        );
      } catch (err) {
        console.warn('MariaDB download_tokens insert failed:', err);
      }
    }

    db.downloadTokens.unshift(dt);
    return { token: rawToken, expiresAt };
  }

  async verifyAndConsumeToken(
    token: string
  ): Promise<{ valid: boolean; entitlement?: DownloadEntitlement; product?: Product; error?: string }> {
    const tokenHash = this.hashToken(token);
    const now = Date.now();

    // Check memory
    const memToken = db.downloadTokens.find(
      (t) => (t.token === token || t.tokenHash === tokenHash) && new Date(t.expiresAt).getTime() > now
    );

    let entitlementId = memToken?.entitlementId;

    if (!entitlementId) {
      const dbStatus = getLastDatabaseStatus();
      if (dbStatus.connected) {
        try {
          const rows = await executeQuery<any>(
            `SELECT * FROM download_tokens WHERE token_hash = ? AND expires_at > NOW() LIMIT 1`,
            [tokenHash]
          );
          if (rows.length > 0) {
            entitlementId = rows[0].entitlement_id;
          }
        } catch (err) {
          console.warn('MariaDB download_tokens verify failed:', err);
        }
      }
    }

    if (!entitlementId) {
      return { valid: false, error: 'Ungültiger oder abgelaufener Download-Token.' };
    }

    // Load entitlement
    let ent = db.entitlements.find((e) => e.id === entitlementId);
    if (!ent) {
      const dbStatus = getLastDatabaseStatus();
      if (dbStatus.connected) {
        try {
          const rows = await executeQuery<any>(
            `SELECT * FROM download_entitlements WHERE id = ? LIMIT 1`,
            [entitlementId]
          );
          if (rows.length > 0) {
            ent = {
              id: rows[0].id,
              userId: rows[0].user_id,
              productId: rows[0].product_id,
              orderId: rows[0].order_id,
              versionId: rows[0].version_id,
              createdAt: rows[0].created_at,
            };
          }
        } catch (err) {
          console.warn('MariaDB entitlement load failed:', err);
        }
      }
    }

    if (!ent) {
      return { valid: false, error: 'Download-Berechtigung nicht gefunden.' };
    }

    const product = await productRepository.findById(ent.productId);
    return {
      valid: true,
      entitlement: ent,
      product: product || undefined,
    };
  }
}

export const downloadRepository = new DownloadRepository();
