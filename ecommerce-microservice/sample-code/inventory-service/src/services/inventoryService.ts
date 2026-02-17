import { getKafkaProducer } from '../config/kafka';
import { InventoryModel } from '../models/inventory';
import { InventoryItem, CreateInventoryRequest, UpdateInventoryRequest, ReserveStockRequest, ReleaseStockRequest } from '../types';
import logger from '../utils/logger';

export class InventoryService {
  private inventoryModel = new InventoryModel();

  async createInventory(request: CreateInventoryRequest): Promise<InventoryItem> {
    const item: InventoryItem = {
      productId: request.productId,
      variantId: request.variantId,
      sku: request.sku,
      quantityAvailable: request.quantityAvailable,
      quantityReserved: 0,
      lowStockThreshold: request.lowStockThreshold || 10,
      location: request.location,
    };

    const created = await this.inventoryModel.create(item);

    // Check for alerts
    await this.checkStockAlerts(created);

    // Publish event
    await this.publishEvent('inventory.created', {
      inventoryId: created.id,
      productId: request.productId,
      variantId: request.variantId,
      sku: request.sku,
      quantityAvailable: request.quantityAvailable,
    });

    return created;
  }

  async getInventory(id: string): Promise<InventoryItem | null> {
    return this.inventoryModel.findById(id);
  }

  async getInventoryByProduct(productId: string, variantId?: string): Promise<InventoryItem | null> {
    return this.inventoryModel.findByProduct(productId, variantId);
  }

  async getInventoryBySku(sku: string): Promise<InventoryItem | null> {
    return this.inventoryModel.findBySku(sku);
  }

  async updateInventory(id: string, updates: UpdateInventoryRequest): Promise<void> {
    await this.inventoryModel.update(id, updates);

    const updated = await this.inventoryModel.findById(id);
    if (updated) {
      await this.checkStockAlerts(updated);
    }

    await this.publishEvent('inventory.updated', { inventoryId: id, updates });
  }

  async reserveStock(request: ReserveStockRequest): Promise<void> {
    const inventory = await this.inventoryModel.findByProduct(request.productId, request.variantId);
    if (!inventory) {
      throw new Error('Inventory item not found');
    }

    const movement = {
      inventoryId: inventory.id!,
      movementType: 'reservation' as const,
      quantity: request.quantity,
      referenceId: request.referenceId,
      referenceType: request.referenceType,
      notes: request.notes,
    };

    await this.inventoryModel.reserveStock(inventory.id!, request.quantity, movement);

    const updated = await this.inventoryModel.findById(inventory.id!);
    if (updated) {
      await this.checkStockAlerts(updated);
    }

    await this.publishEvent('inventory.reserved', {
      inventoryId: inventory.id,
      productId: request.productId,
      variantId: request.variantId,
      quantity: request.quantity,
      referenceId: request.referenceId,
    });
  }

  async releaseStock(request: ReleaseStockRequest): Promise<void> {
    const inventory = await this.inventoryModel.findByProduct(request.productId, request.variantId);
    if (!inventory) {
      throw new Error('Inventory item not found');
    }

    const movement = {
      inventoryId: inventory.id!,
      movementType: 'release' as const,
      quantity: request.quantity,
      referenceId: request.referenceId,
      referenceType: request.referenceType,
      notes: request.notes,
    };

    await this.inventoryModel.releaseStock(inventory.id!, request.quantity, movement);

    await this.publishEvent('inventory.released', {
      inventoryId: inventory.id,
      productId: request.productId,
      variantId: request.variantId,
      quantity: request.quantity,
      referenceId: request.referenceId,
    });
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    return this.inventoryModel.findLowStock();
  }

  async getOutOfStockItems(): Promise<InventoryItem[]> {
    return this.inventoryModel.findOutOfStock();
  }

  async getStockAlerts(): Promise<any[]> {
    return this.inventoryModel.getAlerts(false);
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    await this.inventoryModel.acknowledgeAlert(alertId, acknowledgedBy);
  }

  private async checkStockAlerts(inventory: InventoryItem): Promise<void> {
    if (inventory.quantityAvailable === 0) {
      await this.inventoryModel.createAlert({
        inventoryId: inventory.id!,
        alertType: 'out_of_stock',
        message: `Product ${inventory.productId} is out of stock`,
        acknowledged: false,
      });
    } else if (inventory.quantityAvailable <= inventory.lowStockThreshold) {
      await this.inventoryModel.createAlert({
        inventoryId: inventory.id!,
        alertType: 'low_stock',
        message: `Product ${inventory.productId} is low on stock (${inventory.quantityAvailable} remaining)`,
        acknowledged: false,
      });
    }
  }

  private async publishEvent(topic: string, data: any): Promise<void> {
    try {
      const producer = await getKafkaProducer();
      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(data) }],
      });
      logger.debug('Event published', { topic, data });
    } catch (error) {
      logger.error('Failed to publish event', { topic, error });
    }
  }
}

export default new InventoryService();