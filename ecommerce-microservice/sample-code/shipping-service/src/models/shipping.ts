import { Pool } from 'pg';
import { getDatabasePool } from '../config/database';
import { ShippingMethod, Shipment, ShipmentStatus } from '../types';
import logger from '../utils/logger';

export class ShippingModel {
  private pool: Pool = getDatabasePool();

  // Shipping Methods
  async createShippingMethod(method: ShippingMethod): Promise<ShippingMethod> {
    const result = await this.pool.query(`
      INSERT INTO shipping_methods (name, description, carrier, estimated_days_min, estimated_days_max, cost, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `, [
      method.name,
      method.description,
      method.carrier,
      method.estimatedDaysMin,
      method.estimatedDaysMax,
      method.cost,
      method.isActive ?? true,
    ]);

    return {
      ...method,
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at,
    };
  }

  async getShippingMethods(): Promise<ShippingMethod[]> {
    const result = await this.pool.query(`
      SELECT * FROM shipping_methods WHERE is_active = TRUE ORDER BY cost ASC
    `);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      carrier: row.carrier,
      estimatedDaysMin: row.estimated_days_min,
      estimatedDaysMax: row.estimated_days_max,
      cost: parseFloat(row.cost),
      isActive: row.is_active,
      createdAt: row.created_at,
    }));
  }

  async getShippingMethod(id: string): Promise<ShippingMethod | null> {
    const result = await this.pool.query(`
      SELECT * FROM shipping_methods WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      carrier: row.carrier,
      estimatedDaysMin: row.estimated_days_min,
      estimatedDaysMax: row.estimated_days_max,
      cost: parseFloat(row.cost),
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }

  // Shipments
  async createShipment(shipment: Shipment): Promise<Shipment> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(`
        INSERT INTO shipments (order_id, shipping_method_id, status, shipping_cost, weight_kg, dimensions, origin_address, destination_address, estimated_delivery)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, created_at, updated_at
      `, [
        shipment.orderId,
        shipment.shippingMethodId,
        shipment.status,
        shipment.shippingCost,
        shipment.weightKg,
        JSON.stringify(shipment.dimensions),
        JSON.stringify(shipment.originAddress),
        JSON.stringify(shipment.destinationAddress),
        shipment.estimatedDelivery,
      ]);

      // Insert initial status history
      await client.query(`
        INSERT INTO shipment_status_history (shipment_id, status)
        VALUES ($1, $2)
      `, [result.rows[0].id, shipment.status]);

      await client.query('COMMIT');

      return {
        ...shipment,
        id: result.rows[0].id,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getShipment(id: string): Promise<Shipment | null> {
    const result = await this.pool.query(`
      SELECT * FROM shipments WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      orderId: row.order_id,
      shippingMethodId: row.shipping_method_id,
      trackingNumber: row.tracking_number,
      status: row.status,
      shippingCost: parseFloat(row.shipping_cost),
      weightKg: row.weight_kg,
      dimensions: row.dimensions,
      originAddress: row.origin_address,
      destinationAddress: row.destination_address,
      shippedAt: row.shipped_at,
      deliveredAt: row.delivered_at,
      estimatedDelivery: row.estimated_delivery,
      carrierData: row.carrier_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getShipmentByOrderId(orderId: string): Promise<Shipment | null> {
    const result = await this.pool.query(`
      SELECT * FROM shipments WHERE order_id = $1
    `, [orderId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      orderId: row.order_id,
      shippingMethodId: row.shipping_method_id,
      trackingNumber: row.tracking_number,
      status: row.status,
      shippingCost: parseFloat(row.shipping_cost),
      weightKg: row.weight_kg,
      dimensions: row.dimensions,
      originAddress: row.origin_address,
      destinationAddress: row.destination_address,
      shippedAt: row.shipped_at,
      deliveredAt: row.delivered_at,
      estimatedDelivery: row.estimated_delivery,
      carrierData: row.carrier_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateShipmentStatus(id: string, status: ShipmentStatus, trackingNumber?: string, notes?: string, location?: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      updates.push(`status = $${paramIndex++}`);
      values.push(status);

      if (trackingNumber) {
        updates.push(`tracking_number = $${paramIndex++}`);
        values.push(trackingNumber);
      }

      if (status === 'shipped') {
        updates.push(`shipped_at = NOW()`);
      } else if (status === 'delivered') {
        updates.push(`delivered_at = NOW()`);
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const query = `UPDATE shipments SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

      await client.query(query, values);

      // Insert status history
      await client.query(`
        INSERT INTO shipment_status_history (shipment_id, status, notes, location)
        VALUES ($1, $2, $3, $4)
      `, [id, status, notes, location]);

      await client.query('COMMIT');

      logger.info('Shipment status updated', { shipmentId: id, status });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getShipmentHistory(shipmentId: string): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT * FROM shipment_status_history
      WHERE shipment_id = $1
      ORDER BY changed_at DESC
    `, [shipmentId]);

    return result.rows;
  }

  async calculateShippingCost(weightKg: number, destination: string): Promise<number> {
    // Mock calculation - in production, integrate with carrier APIs
    const baseCost = 5.99;
    const weightCost = weightKg * 0.5;
    const zoneCost = destination === 'US' ? 0 : 2.99;
    return Math.round((baseCost + weightCost + zoneCost) * 100) / 100;
  }
}