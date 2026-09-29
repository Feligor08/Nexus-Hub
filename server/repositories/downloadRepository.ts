import crypto from 'crypto';
import { executeQuery, getLastDatabaseStatus, withTransaction } from '../config/database';
import { DownloadEntitlement, DownloadToken, Product } from '../models/types';
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
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Download-Berechtigung konnte nicht gespeichert werden.');
    }
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

    await executeQuery(
      `INSERT INTO download_entitlements (id, user_id, product_id, order_id, version_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, userId, productId, orderId, versionId || null]
    );
    return entitlement;
  }

  async getUserEntitlements(userId: string): Promise<DownloadEntitlement[]> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Downloads sind derzeit nicht verfügbar.');
    }
    const rows = await executeQuery<any>(
      `SELECT de.*, p.name AS product_name, p.file_format, p.file_size, p.version
       FROM download_entitlements de JOIN products p ON p.id = de.product_id
       WHERE de.user_id = ? ORDER BY de.created_at DESC`,
      [userId]
    );
    return rows.map((row) => ({
      id: row.id, userId: row.user_id, productId: row.product_id,
      orderId: row.order_id, versionId: row.version_id, productName: row.product_name,
      fileFormat: row.file_format, fileSize: row.file_size, version: row.version,
      createdAt: row.created_at,
    }));
  }

  async createDownloadToken(
    entitlementId: string,
    userId: string,
    ttlHours: number = 24
  ): Promise<{ token: string; expiresAt: string }> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Download-Token konnte nicht erstellt werden.');
    }
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

    await executeQuery(
      `INSERT INTO download_tokens (id, entitlement_id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, entitlementId, userId, tokenHash, new Date(expiresAt)]
    );
    return { token: rawToken, expiresAt };
  }

  async verifyAndConsumeToken(
    token: string
  ): Promise<{ valid: boolean; entitlement?: DownloadEntitlement; product?: Product; error?: string }> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Download-Berechtigung kann nicht geprüft werden.');
    }
    const tokenHash = this.hashToken(token);
    const verified = await withTransaction(async (connection) => {
      const [tokenRows] = await connection.execute<any[]>(
        `SELECT id, entitlement_id, user_id FROM download_tokens
         WHERE token_hash = ? AND expires_at > NOW() AND used_at IS NULL LIMIT 1 FOR UPDATE`,
        [tokenHash]
      );
      const tokenRow = tokenRows[0];
      if (!tokenRow) return null;
      const [updateResult] = await connection.execute(
        `UPDATE download_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL`,
        [tokenRow.id]
      );
      if ((updateResult as { affectedRows: number }).affectedRows === 0) return null;
      const [entitlementRows] = await connection.execute<any[]>(
        `SELECT * FROM download_entitlements WHERE id = ? AND user_id = ? LIMIT 1`,
        [tokenRow.entitlement_id, tokenRow.user_id]
      );
      if (!entitlementRows.length) return null;
      const row = entitlementRows[0];
      return {
        entitlement: {
          id: row.id,
          userId: row.user_id,
          productId: row.product_id,
          orderId: row.order_id,
          versionId: row.version_id,
          createdAt: row.created_at,
        } as DownloadEntitlement,
      };
    });

    if (!verified) {
      return { valid: false, error: 'Ungültiger oder abgelaufener Download-Token.' };
    }
    const product = await productRepository.findById(verified.entitlement.productId);
    return {
      valid: Boolean(product),
      entitlement: verified.entitlement,
      product: product || undefined,
      error: product ? undefined : 'Produkt nicht gefunden.',
    };
  }
}

export const downloadRepository = new DownloadRepository();
