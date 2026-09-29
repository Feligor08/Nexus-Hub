import { withTransaction, executeQuery, getLastDatabaseStatus } from '../config/database';
import { Order, OrderItem } from '../models/types';
import { db } from '../db';

export class OrderRepository {
  async create(order: Order): Promise<Order> {
    const dbStatus = getLastDatabaseStatus();

    if (dbStatus.connected) {
      try {
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
      } catch (err) {
        console.warn('MariaDB transaction failed in OrderRepository.create:', err);
      }
    }

    db.orders.unshift(order);
    return order;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
          [userId]
        );

        const orders: Order[] = await Promise.all(
          rows.map(async (r) => {
            const itemRows = await executeQuery<any>(
              `SELECT * FROM order_items WHERE order_id = ?`,
              [r.id]
            );
            return {
              id: r.id,
              userId: r.user_id,
              customerEmail: r.customer_email,
              totalAmount: Number(r.total_amount),
              currency: r.currency,
              status: r.status,
              paymentStatus: r.payment_status,
              downloadToken: r.download_token,
              createdAt: r.created_at,
              items: itemRows.map((it) => ({
                productId: it.product_id,
                name: it.product_name_snapshot,
                price: Number(it.unit_price),
                quantity: it.quantity,
                fileFormat: it.file_format_snapshot,
              })),
            };
          })
        );
        return orders;
      } catch (err) {
        console.warn('MariaDB findByUserId failed:', err);
      }
    }

    return db.orders.filter((o) => o.userId === userId);
  }
}

export const orderRepository = new OrderRepository();
