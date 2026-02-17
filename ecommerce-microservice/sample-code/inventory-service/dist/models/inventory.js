"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryModel = void 0;
const database_1 = require("../config/database");
class InventoryModel {
    pool = (0, database_1.getDatabasePool)();
    async create(item) {
        const result = await this.pool.query(`
      INSERT INTO inventory (product_id, variant_id, sku, quantity_available, quantity_reserved, low_stock_threshold, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at, last_updated
    `, [
            item.productId,
            item.variantId,
            item.sku,
            item.quantityAvailable,
            item.quantityReserved || 0,
            item.lowStockThreshold || 10,
            item.location,
        ]);
        return {
            ...item,
            id: result.rows[0].id,
            createdAt: result.rows[0].created_at,
            lastUpdated: result.rows[0].last_updated,
        };
    }
    async findById(id) {
        const result = await this.pool.query(`
      SELECT * FROM inventory WHERE id = $1
    `, [id]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: row.id,
            productId: row.product_id,
            variantId: row.variant_id,
            sku: row.sku,
            quantityAvailable: row.quantity_available,
            quantityReserved: row.quantity_reserved,
            lowStockThreshold: row.low_stock_threshold,
            location: row.location,
            lastUpdated: row.last_updated,
            createdAt: row.created_at,
        };
    }
    async findByProduct(productId, variantId) {
        const result = await this.pool.query(`
      SELECT * FROM inventory WHERE product_id = $1 AND variant_id IS NOT DISTINCT FROM $2
    `, [productId, variantId]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: row.id,
            productId: row.product_id,
            variantId: row.variant_id,
            sku: row.sku,
            quantityAvailable: row.quantity_available,
            quantityReserved: row.quantity_reserved,
            lowStockThreshold: row.low_stock_threshold,
            location: row.location,
            lastUpdated: row.last_updated,
            createdAt: row.created_at,
        };
    }
    async findBySku(sku) {
        const result = await this.pool.query(`
      SELECT * FROM inventory WHERE sku = $1
    `, [sku]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: row.id,
            productId: row.product_id,
            variantId: row.variant_id,
            sku: row.sku,
            quantityAvailable: row.quantity_available,
            quantityReserved: row.quantity_reserved,
            lowStockThreshold: row.low_stock_threshold,
            location: row.location,
            lastUpdated: row.last_updated,
            createdAt: row.created_at,
        };
    }
    async findLowStock() {
        const result = await this.pool.query(`
      SELECT * FROM inventory
      WHERE quantity_available <= low_stock_threshold AND quantity_available > 0
      ORDER BY quantity_available ASC
    `);
        return result.rows.map(row => ({
            id: row.id,
            productId: row.product_id,
            variantId: row.variant_id,
            sku: row.sku,
            quantityAvailable: row.quantity_available,
            quantityReserved: row.quantity_reserved,
            lowStockThreshold: row.low_stock_threshold,
            location: row.location,
            lastUpdated: row.last_updated,
            createdAt: row.created_at,
        }));
    }
    async findOutOfStock() {
        const result = await this.pool.query(`
      SELECT * FROM inventory
      WHERE quantity_available = 0
      ORDER BY last_updated DESC
    `);
        return result.rows.map(row => ({
            id: row.id,
            productId: row.product_id,
            variantId: row.variant_id,
            sku: row.sku,
            quantityAvailable: row.quantity_available,
            quantityReserved: row.quantity_reserved,
            lowStockThreshold: row.low_stock_threshold,
            location: row.location,
            lastUpdated: row.last_updated,
            createdAt: row.created_at,
        }));
    }
    async update(id, updates) {
        const fields = [];
        const values = [];
        let paramIndex = 1;
        if (updates.quantityAvailable !== undefined) {
            fields.push(`quantity_available = $${paramIndex++}`);
            values.push(updates.quantityAvailable);
        }
        if (updates.lowStockThreshold !== undefined) {
            fields.push(`low_stock_threshold = $${paramIndex++}`);
            values.push(updates.lowStockThreshold);
        }
        if (updates.location !== undefined) {
            fields.push(`location = $${paramIndex++}`);
            values.push(updates.location);
        }
        if (fields.length === 0)
            return;
        fields.push(`last_updated = NOW()`);
        values.push(id);
        const query = `UPDATE inventory SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
        await this.pool.query(query, values);
    }
    async reserveStock(inventoryId, quantity, movement) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Check available stock
            const checkResult = await client.query(`
        SELECT quantity_available, quantity_reserved FROM inventory WHERE id = $1 FOR UPDATE
      `, [inventoryId]);
            if (checkResult.rows.length === 0) {
                throw new Error('Inventory item not found');
            }
            const { quantity_available, quantity_reserved } = checkResult.rows[0];
            if (quantity_available < quantity) {
                throw new Error('Insufficient stock available');
            }
            // Update inventory
            await client.query(`
        UPDATE inventory
        SET quantity_available = quantity_available - $1,
            quantity_reserved = quantity_reserved + $1,
            last_updated = NOW()
        WHERE id = $2
      `, [quantity, inventoryId]);
            // Record movement
            await client.query(`
        INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_id, reference_type, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
                inventoryId,
                movement.movementType,
                movement.quantity,
                movement.referenceId,
                movement.referenceType,
                movement.notes,
                movement.createdBy,
            ]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async releaseStock(inventoryId, quantity, movement) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Check reserved stock
            const checkResult = await client.query(`
        SELECT quantity_reserved FROM inventory WHERE id = $1 FOR UPDATE
      `, [inventoryId]);
            if (checkResult.rows.length === 0) {
                throw new Error('Inventory item not found');
            }
            const { quantity_reserved } = checkResult.rows[0];
            if (quantity_reserved < quantity) {
                throw new Error('Insufficient reserved stock');
            }
            // Update inventory
            await client.query(`
        UPDATE inventory
        SET quantity_available = quantity_available + $1,
            quantity_reserved = quantity_reserved - $1,
            last_updated = NOW()
        WHERE id = $2
      `, [quantity, inventoryId]);
            // Record movement
            await client.query(`
        INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_id, reference_type, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
                inventoryId,
                movement.movementType,
                movement.quantity,
                movement.referenceId,
                movement.referenceType,
                movement.notes,
                movement.createdBy,
            ]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async adjustStock(inventoryId, quantity, movement) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Update inventory
            await client.query(`
        UPDATE inventory
        SET quantity_available = quantity_available + $1,
            last_updated = NOW()
        WHERE id = $2
      `, [quantity, inventoryId]);
            // Record movement
            await client.query(`
        INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_id, reference_type, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
                inventoryId,
                movement.movementType,
                Math.abs(movement.quantity),
                movement.referenceId,
                movement.referenceType,
                movement.notes,
                movement.createdBy,
            ]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async createAlert(alert) {
        await this.pool.query(`
      INSERT INTO stock_alerts (inventory_id, alert_type, message)
      VALUES ($1, $2, $3)
    `, [alert.inventoryId, alert.alertType, alert.message]);
    }
    async getAlerts(acknowledged = false) {
        const result = await this.pool.query(`
      SELECT * FROM stock_alerts
      WHERE acknowledged = $1
      ORDER BY created_at DESC
    `, [acknowledged]);
        return result.rows.map(row => ({
            id: row.id,
            inventoryId: row.inventory_id,
            alertType: row.alert_type,
            message: row.message,
            acknowledged: row.acknowledged,
            acknowledgedAt: row.acknowledged_at,
            acknowledgedBy: row.acknowledged_by,
            createdAt: row.created_at,
        }));
    }
    async acknowledgeAlert(alertId, acknowledgedBy) {
        await this.pool.query(`
      UPDATE stock_alerts
      SET acknowledged = TRUE, acknowledged_at = NOW(), acknowledged_by = $2
      WHERE id = $1
    `, [alertId, acknowledgedBy]);
    }
}
exports.InventoryModel = InventoryModel;
//# sourceMappingURL=inventory.js.map