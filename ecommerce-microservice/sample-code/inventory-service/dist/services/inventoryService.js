"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const kafka_1 = require("../config/kafka");
const inventory_1 = require("../models/inventory");
const logger_1 = __importDefault(require("../utils/logger"));
class InventoryService {
    inventoryModel = new inventory_1.InventoryModel();
    async createInventory(request) {
        const item = {
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
    async getInventory(id) {
        return this.inventoryModel.findById(id);
    }
    async getInventoryByProduct(productId, variantId) {
        return this.inventoryModel.findByProduct(productId, variantId);
    }
    async getInventoryBySku(sku) {
        return this.inventoryModel.findBySku(sku);
    }
    async updateInventory(id, updates) {
        await this.inventoryModel.update(id, updates);
        const updated = await this.inventoryModel.findById(id);
        if (updated) {
            await this.checkStockAlerts(updated);
        }
        await this.publishEvent('inventory.updated', { inventoryId: id, updates });
    }
    async reserveStock(request) {
        const inventory = await this.inventoryModel.findByProduct(request.productId, request.variantId);
        if (!inventory) {
            throw new Error('Inventory item not found');
        }
        const movement = {
            inventoryId: inventory.id,
            movementType: 'reservation',
            quantity: request.quantity,
            referenceId: request.referenceId,
            referenceType: request.referenceType,
            notes: request.notes,
        };
        await this.inventoryModel.reserveStock(inventory.id, request.quantity, movement);
        const updated = await this.inventoryModel.findById(inventory.id);
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
    async releaseStock(request) {
        const inventory = await this.inventoryModel.findByProduct(request.productId, request.variantId);
        if (!inventory) {
            throw new Error('Inventory item not found');
        }
        const movement = {
            inventoryId: inventory.id,
            movementType: 'release',
            quantity: request.quantity,
            referenceId: request.referenceId,
            referenceType: request.referenceType,
            notes: request.notes,
        };
        await this.inventoryModel.releaseStock(inventory.id, request.quantity, movement);
        await this.publishEvent('inventory.released', {
            inventoryId: inventory.id,
            productId: request.productId,
            variantId: request.variantId,
            quantity: request.quantity,
            referenceId: request.referenceId,
        });
    }
    async getLowStockItems() {
        return this.inventoryModel.findLowStock();
    }
    async getOutOfStockItems() {
        return this.inventoryModel.findOutOfStock();
    }
    async getStockAlerts() {
        return this.inventoryModel.getAlerts(false);
    }
    async acknowledgeAlert(alertId, acknowledgedBy) {
        await this.inventoryModel.acknowledgeAlert(alertId, acknowledgedBy);
    }
    async checkStockAlerts(inventory) {
        if (inventory.quantityAvailable === 0) {
            await this.inventoryModel.createAlert({
                inventoryId: inventory.id,
                alertType: 'out_of_stock',
                message: `Product ${inventory.productId} is out of stock`,
            });
        }
        else if (inventory.quantityAvailable <= inventory.lowStockThreshold) {
            await this.inventoryModel.createAlert({
                inventoryId: inventory.id,
                alertType: 'low_stock',
                message: `Product ${inventory.productId} is low on stock (${inventory.quantityAvailable} remaining)`,
            });
        }
    }
    async publishEvent(topic, data) {
        try {
            const producer = await (0, kafka_1.getKafkaProducer)();
            await producer.send({
                topic,
                messages: [{ value: JSON.stringify(data) }],
            });
            logger_1.default.debug('Event published', { topic, data });
        }
        catch (error) {
            logger_1.default.error('Failed to publish event', { topic, error });
        }
    }
}
exports.InventoryService = InventoryService;
exports.default = new InventoryService();
//# sourceMappingURL=inventoryService.js.map