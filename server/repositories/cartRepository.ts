import { executeQuery, getLastDatabaseStatus, withTransaction } from '../config/database';
import { productRepository } from './productRepository';

export interface CartItemDetail {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  fileFormat: string;
  fileSize: string;
  version: string;
  slug: string;
  images?: string[];
  shortDesc?: string;
}

export class CartRepository {
  private requireDatabase(): void {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Der Warenkorb ist derzeit nicht verfügbar.');
    }
  }

  async getCart(userId?: string, sessionId?: string): Promise<CartItemDetail[]> {
    const dbStatus = getLastDatabaseStatus();
    if (!dbStatus.connected) {
      return [];
    }

    try {
      let cartId: string | null = null;
      if (userId) {
        const rows = await executeQuery<any>(`SELECT id FROM carts WHERE user_id = ? LIMIT 1`, [userId]);
        if (rows.length > 0) cartId = rows[0].id;
      } else if (sessionId) {
        const rows = await executeQuery<any>(`SELECT id FROM carts WHERE session_id = ? LIMIT 1`, [sessionId]);
        if (rows.length > 0) cartId = rows[0].id;
      }

      if (cartId) {
        const itemsRows = await executeQuery<any>(
          `SELECT product_id, quantity FROM cart_items WHERE cart_id = ?`,
          [cartId]
        );

        const result: CartItemDetail[] = [];
        for (const item of itemsRows) {
          const product = await productRepository.findById(item.product_id);
          if (product) {
            result.push({
              id: product.id,
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: item.quantity,
              fileFormat: product.fileFormat || 'ZIP',
              fileSize: product.fileSize || '10 MB',
              version: product.version || '1.0.0',
              slug: product.slug,
              images: product.images,
              shortDesc: product.shortDesc,
            });
          }
        }
        return result;
      }
    } catch (err) {
      console.warn('MariaDB getCart error:', err);
    }

    return [];
  }

  async addItem(productId: string, quantity: number, userId?: string, sessionId?: string): Promise<CartItemDetail[]> {
    this.requireDatabase();
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error('Produkt nicht gefunden');
    }

    const safeQty = Math.max(1, quantity || 1);

    await withTransaction(async (conn) => {
      let cartId: string | null = null;
      if (userId) {
        const [rows] = await conn.execute(`SELECT id FROM carts WHERE user_id = ? LIMIT 1`, [userId]);
        if ((rows as any[]).length > 0) {
          cartId = (rows as any[])[0].id;
        } else {
          cartId = `cart-usr-${Date.now()}`;
          await conn.execute(`INSERT INTO carts (id, user_id) VALUES (?, ?)`, [cartId, userId]);
        }
      } else {
        const sId = sessionId || 'anon';
        const [rows] = await conn.execute(`SELECT id FROM carts WHERE session_id = ? LIMIT 1`, [sId]);
        if ((rows as any[]).length > 0) {
          cartId = (rows as any[])[0].id;
        } else {
          cartId = `cart-ses-${Date.now()}`;
          await conn.execute(`INSERT INTO carts (id, session_id) VALUES (?, ?)`, [cartId, sId]);
        }
      }

      // Check if item exists in cart
      const [itemRows] = await conn.execute(
        `SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1`,
        [cartId, productId]
      );

      if ((itemRows as any[]).length > 0) {
        const currentQty = (itemRows as any[])[0].quantity;
        await conn.execute(
          `UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?`,
          [currentQty + safeQty, cartId, productId]
        );
      } else {
        await conn.execute(
          `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)`,
          [cartId, productId, safeQty]
        );
      }
    });

    return this.getCart(userId, sessionId);
  }

  async updateQuantity(productId: string, quantity: number, userId?: string, sessionId?: string): Promise<CartItemDetail[]> {
    this.requireDatabase();
    const safeQty = Math.max(0, quantity);

    if (safeQty === 0) {
      return this.removeItem(productId, userId, sessionId);
    }

    let cartId: string | null = null;
    if (userId) {
      const rows = await executeQuery<any>(`SELECT id FROM carts WHERE user_id = ? LIMIT 1`, [userId]);
      if (rows.length > 0) cartId = rows[0].id;
    } else if (sessionId) {
      const rows = await executeQuery<any>(`SELECT id FROM carts WHERE session_id = ? LIMIT 1`, [sessionId]);
      if (rows.length > 0) cartId = rows[0].id;
    }

    if (cartId) {
      await executeQuery(
        `UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?`,
        [safeQty, cartId, productId]
      );
    }
    return this.getCart(userId, sessionId);
  }

  async removeItem(productId: string, userId?: string, sessionId?: string): Promise<CartItemDetail[]> {
    this.requireDatabase();
    let cartId: string | null = null;
    if (userId) {
      const rows = await executeQuery<any>(`SELECT id FROM carts WHERE user_id = ? LIMIT 1`, [userId]);
      if (rows.length > 0) cartId = rows[0].id;
    } else if (sessionId) {
      const rows = await executeQuery<any>(`SELECT id FROM carts WHERE session_id = ? LIMIT 1`, [sessionId]);
      if (rows.length > 0) cartId = rows[0].id;
    }

    if (cartId) {
      await executeQuery(`DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?`, [cartId, productId]);
    }
    return this.getCart(userId, sessionId);
  }

  async clearCart(userId?: string, sessionId?: string): Promise<void> {
    const dbStatus = getLastDatabaseStatus();
    if (!dbStatus.connected) return;

    try {
      let cartId: string | null = null;
      if (userId) {
        const rows = await executeQuery<any>(`SELECT id FROM carts WHERE user_id = ? LIMIT 1`, [userId]);
        if (rows.length > 0) cartId = rows[0].id;
      } else if (sessionId) {
        const rows = await executeQuery<any>(`SELECT id FROM carts WHERE session_id = ? LIMIT 1`, [sessionId]);
        if (rows.length > 0) cartId = rows[0].id;
      }

      if (cartId) {
        await executeQuery(`DELETE FROM cart_items WHERE cart_id = ?`, [cartId]);
      }
    } catch (err) {
      console.warn('MariaDB clearCart error:', err);
    }
  }

  async mergeGuestCart(sessionId: string, userId: string): Promise<void> {
    const guestItems = await this.getCart(undefined, sessionId);
    if (guestItems.length === 0) return;

    for (const item of guestItems) {
      await this.addItem(item.productId, item.quantity, userId);
    }
    await this.clearCart(undefined, sessionId);
  }
}

export const cartRepository = new CartRepository();
