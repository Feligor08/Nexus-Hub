import { withTransaction, executeQuery, getLastDatabaseStatus } from '../config/database';
import { Order, OrderItem } from '../models/types';

export class OrderRepository {
  async create(order: Order): Promise<Order> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Die Bestellung wurde nicht gespeichert.');
    }

    await withTransaction(async (conn) => {
          // 1. Insert order
          await conn.execute(
            `INSERT INTO orders (id, user_id, customer_email, total_amount, currency, status, payment_status, download_token, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              order.id,
              order.userId,
              order.customerEmail,
              order.totalAmount,
              order.currency,
              order.status,
              order.paymentStatus,
              order.downloadToken,
              order.createdAt,
            ]
          );

          // 2. Insert order items snapshot
          for (const item of order.items) {
            await conn.execute(
              `INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price, quantity, file_format_snapshot)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                order.id,
                item.productId,
                item.name,
                item.price,
                item.quantity,
                item.fileFormat || 'ZIP',
              ]
            );
          }
    });
    return order;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Bestellungen sind derzeit nicht verfügbar.');
    }
    const rows = await executeQuery<any>(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    return Promise.all(rows.map(async (row) => {
      const itemRows = await executeQuery<any>(`SELECT * FROM order_items WHERE order_id = ?`, [row.id]);
      return {
        id: row.id,
        userId: row.user_id,
        customerEmail: row.customer_email,
        totalAmount: Number(row.total_amount),
        currency: row.currency,
        status: row.status,
        paymentStatus: row.payment_status,
        downloadToken: row.download_token,
        createdAt: row.created_at,
        items: itemRows.map((item: any): OrderItem => ({
          productId: item.product_id,
          name: item.product_name_snapshot,
          price: Number(item.unit_price),
          quantity: item.quantity,
          fileFormat: item.file_format_snapshot,
        })),
      };
    }));
  }
}

export const orderRepository = new OrderRepository();
