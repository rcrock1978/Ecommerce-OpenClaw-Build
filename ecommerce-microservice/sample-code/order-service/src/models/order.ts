import { Pool } from 'pg';
import { getDatabasePool } from '../config/database';
import { Order, OrderItem, OrderStatus } from '../types';
import logger from '../utils/logger';

export class OrderModel {
  private pool: Pool = getDatabasePool();

  async create(order: Order): Promise<Order> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Insert order
      const orderResult = await client.query(`
        INSERT INTO orders (user_id, status, total_amount, shipping_address, billing_address, payment_method)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at, updated_at
      `, [
        order.userId,
        order.status,
        order.totalAmount,
        JSON.stringify(order.shippingAddress),
        JSON.stringify(order.billingAddress),
        JSON.stringify(order.paymentMethod)
      ]);

      const orderId = orderResult.rows[0].id;
      const createdAt = orderResult.rows[0].created_at;
      const updatedAt = orderResult.rows[0].updated_at;

      // Insert order items
      for (const item of order.items) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          orderId,
          item.productId,
          item.variantId,
          item.quantity,
          item.unitPrice,
          item.totalPrice
        ]);
      }

      // Insert initial status history
      await client.query(`
        INSERT INTO order_status_history (order_id, status)
        VALUES ($1, $2)
      `, [orderId, order.status]);

      await client.query('COMMIT');

      logger.info('Order created', { orderId, userId: order.userId });
      return {
        ...order,
        id: orderId,
        createdAt,
        updatedAt,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create order', { error, userId: order.userId });
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(orderId: string): Promise<Order | null> {
    const result = await this.pool.query(`
      SELECT o.*, json_agg(oi.*) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id
    `, [orderId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      totalAmount: parseFloat(row.total_amount),
      shippingAddress: row.shipping_address,
      billingAddress: row.billing_address,
      paymentMethod: row.payment_method,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: row.items.filter((item: any) => item !== null),
    };
  }

  async findByUserId(userId: string, limit = 50, offset = 0): Promise<Order[]> {
    const result = await this.pool.query(`
      SELECT o.*, json_agg(oi.*) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      status: row.status,
      totalAmount: parseFloat(row.total_amount),
      shippingAddress: row.shipping_address,
      billingAddress: row.billing_address,
      paymentMethod: row.payment_method,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: row.items.filter((item: any) => item !== null),
    }));
  }

  async updateStatus(orderId: string, status: OrderStatus, changedBy?: string, notes?: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update order status
      await client.query(`
        UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2
      `, [status, orderId]);

      // Insert status history
      await client.query(`
        INSERT INTO order_status_history (order_id, status, changed_by, notes)
        VALUES ($1, $2, $3, $4)
      `, [orderId, status, changedBy, notes]);

      await client.query('COMMIT');

      logger.info('Order status updated', { orderId, status, changedBy });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update order status', { error, orderId, status });
      throw error;
    } finally {
      client.release();
    }
  }

  async getStatusHistory(orderId: string): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT * FROM order_status_history
      WHERE order_id = $1
      ORDER BY changed_at DESC
    `, [orderId]);

    return result.rows;
  }
}