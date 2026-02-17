"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const validate_1 = require("../middleware/validate");
const inventoryService_1 = __importDefault(require("../services/inventoryService"));
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// ── Validation Schemas ──────────────────────────────────────────────
const createInventorySchema = joi_1.default.object({
    productId: joi_1.default.string().required(),
    variantId: joi_1.default.string().optional(),
    sku: joi_1.default.string().required(),
    quantityAvailable: joi_1.default.number().integer().min(0).required(),
    lowStockThreshold: joi_1.default.number().integer().min(0).default(10),
    location: joi_1.default.string().optional(),
});
const updateInventorySchema = joi_1.default.object({
    quantityAvailable: joi_1.default.number().integer().min(0).optional(),
    lowStockThreshold: joi_1.default.number().integer().min(0).optional(),
    location: joi_1.default.string().optional(),
});
const reserveStockSchema = joi_1.default.object({
    productId: joi_1.default.string().required(),
    variantId: joi_1.default.string().optional(),
    quantity: joi_1.default.number().integer().min(1).required(),
    referenceId: joi_1.default.string().optional(),
    referenceType: joi_1.default.string().valid('order', 'shipment').optional(),
    notes: joi_1.default.string().optional(),
});
const releaseStockSchema = joi_1.default.object({
    productId: joi_1.default.string().required(),
    variantId: joi_1.default.string().optional(),
    quantity: joi_1.default.number().integer().min(1).required(),
    referenceId: joi_1.default.string().optional(),
    referenceType: joi_1.default.string().valid('order', 'shipment').optional(),
    notes: joi_1.default.string().optional(),
});
// ── Routes ──────────────────────────────────────────────────────────
// Create inventory item
router.post('/', (0, validate_1.validateBody)(createInventorySchema), async (req, res) => {
    try {
        const item = await inventoryService_1.default.createInventory(req.body);
        res.status(201).json({ success: true, data: item });
    }
    catch (error) {
        logger_1.default.error('Error creating inventory', { body: req.body, error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Get inventory by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const item = await inventoryService_1.default.getInventory(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Inventory item not found' });
        }
        res.json({ success: true, data: item });
    }
    catch (error) {
        logger_1.default.error('Error getting inventory', { id: req.params.id, error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Get inventory by product
router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { variantId } = req.query;
        const item = await inventoryService_1.default.getInventoryByProduct(productId, variantId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Inventory item not found' });
        }
        res.json({ success: true, data: item });
    }
    catch (error) {
        logger_1.default.error('Error getting inventory by product', { productId: req.params.productId, error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Get inventory by SKU
router.get('/sku/:sku', async (req, res) => {
    try {
        const { sku } = req.params;
        const item = await inventoryService_1.default.getInventoryBySku(sku);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Inventory item not found' });
        }
        res.json({ success: true, data: item });
    }
    catch (error) {
        logger_1.default.error('Error getting inventory by SKU', { sku: req.params.sku, error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Update inventory
router.put('/:id', (0, validate_1.validateBody)(updateInventorySchema), async (req, res) => {
    try {
        const { id } = req.params;
        await inventoryService_1.default.updateInventory(id, req.body);
        res.json({ success: true, message: 'Inventory updated' });
    }
    catch (error) {
        logger_1.default.error('Error updating inventory', { id: req.params.id, body: req.body, error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Reserve stock
router.post('/reserve', (0, validate_1.validateBody)(reserveStockSchema), async (req, res) => {
    try {
        await inventoryService_1.default.reserveStock(req.body);
        res.json({ success: true, message: 'Stock reserved' });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Inventory item not found') {
            return res.status(404).json({ success: false, message: 'Inventory item not found' });
        }
        if (error instanceof Error && error.message === 'Insufficient stock available') {
            return res.status(400).json({ success: false, message: 'Insufficient stock available' });
        }
        logger_1.default.error('Error reserving stock', { body: req.body, error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Release stock
router.post('/release', (0, validate_1.validateBody)(releaseStockSchema), async (req, res) => {
    try {
        await inventoryService_1.default.releaseStock(req.body);
        res.json({ success: true, message: 'Stock released' });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Inventory item not found') {
            return res.status(404).json({ success: false, message: 'Inventory item not found' });
        }
        if (error instanceof Error && error.message === 'Insufficient reserved stock') {
            return res.status(400).json({ success: false, message: 'Insufficient reserved stock' });
        }
        logger_1.default.error('Error releasing stock', { body: req.body, error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Get low stock items
router.get('/alerts/low-stock', async (req, res) => {
    try {
        const items = await inventoryService_1.default.getLowStockItems();
        res.json({ success: true, data: items });
    }
    catch (error) {
        logger_1.default.error('Error getting low stock items', { error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Get out of stock items
router.get('/alerts/out-of-stock', async (req, res) => {
    try {
        const items = await inventoryService_1.default.getOutOfStockItems();
        res.json({ success: true, data: items });
    }
    catch (error) {
        logger_1.default.error('Error getting out of stock items', { error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Get stock alerts
router.get('/alerts', async (req, res) => {
    try {
        const alerts = await inventoryService_1.default.getStockAlerts();
        res.json({ success: true, data: alerts });
    }
    catch (error) {
        logger_1.default.error('Error getting stock alerts', { error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// Acknowledge alert
router.put('/alerts/:alertId/acknowledge', async (req, res) => {
    try {
        const { alertId } = req.params;
        const { acknowledgedBy } = req.body;
        await inventoryService_1.default.acknowledgeAlert(alertId, acknowledgedBy || 'system');
        res.json({ success: true, message: 'Alert acknowledged' });
    }
    catch (error) {
        logger_1.default.error('Error acknowledging alert', { alertId: req.params.alertId, error });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=inventory.js.map