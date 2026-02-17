import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validateBody } from '../middleware/validate';
import inventoryService from '../services/inventoryService';
import logger from '../utils/logger';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────

const createInventorySchema = Joi.object({
  productId: Joi.string().required(),
  variantId: Joi.string().optional(),
  sku: Joi.string().required(),
  quantityAvailable: Joi.number().integer().min(0).required(),
  lowStockThreshold: Joi.number().integer().min(0).default(10),
  location: Joi.string().optional(),
});

const updateInventorySchema = Joi.object({
  quantityAvailable: Joi.number().integer().min(0).optional(),
  lowStockThreshold: Joi.number().integer().min(0).optional(),
  location: Joi.string().optional(),
});

const reserveStockSchema = Joi.object({
  productId: Joi.string().required(),
  variantId: Joi.string().optional(),
  quantity: Joi.number().integer().min(1).required(),
  referenceId: Joi.string().optional(),
  referenceType: Joi.string().valid('order', 'shipment').optional(),
  notes: Joi.string().optional(),
});

const releaseStockSchema = Joi.object({
  productId: Joi.string().required(),
  variantId: Joi.string().optional(),
  quantity: Joi.number().integer().min(1).required(),
  referenceId: Joi.string().optional(),
  referenceType: Joi.string().valid('order', 'shipment').optional(),
  notes: Joi.string().optional(),
});

// ── Routes ──────────────────────────────────────────────────────────

// Create inventory item
router.post('/', validateBody(createInventorySchema), async (req: Request, res: Response) => {
  try {
    const item = await inventoryService.createInventory(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    logger.error('Error creating inventory', { body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get inventory by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await inventoryService.getInventory(id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    res.json({ success: true, data: item });
    return;
  } catch (error) {
    logger.error('Error getting inventory', { id: req.params.id, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get inventory by product
router.get('/product/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { variantId } = req.query as any;
    const item = await inventoryService.getInventoryByProduct(productId, variantId);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    res.json({ success: true, data: item });
    return;
  } catch (error) {
    logger.error('Error getting inventory by product', { productId: req.params.productId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get inventory by SKU
router.get('/sku/:sku', async (req: Request, res: Response) => {
  try {
    const { sku } = req.params;
    const item = await inventoryService.getInventoryBySku(sku);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    res.json({ success: true, data: item });
    return;
  } catch (error) {
    logger.error('Error getting inventory by SKU', { sku: req.params.sku, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update inventory
router.put('/:id', validateBody(updateInventorySchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await inventoryService.updateInventory(id, req.body);
    res.json({ success: true, message: 'Inventory updated' });
    return;
  } catch (error) {
    logger.error('Error updating inventory', { id: req.params.id, body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Reserve stock
router.post('/reserve', validateBody(reserveStockSchema), async (req: Request, res: Response) => {
  try {
    await inventoryService.reserveStock(req.body);
    res.json({ success: true, message: 'Stock reserved' });
    return;
  } catch (error) {
    if (error instanceof Error && error.message === 'Inventory item not found') {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    if (error instanceof Error && error.message === 'Insufficient stock available') {
      return res.status(400).json({ success: false, message: 'Insufficient stock available' });
    }
    logger.error('Error reserving stock', { body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Release stock
router.post('/release', validateBody(releaseStockSchema), async (req: Request, res: Response) => {
  try {
    await inventoryService.releaseStock(req.body);
    res.json({ success: true, message: 'Stock released' });
    return;
  } catch (error) {
    if (error instanceof Error && error.message === 'Inventory item not found') {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    if (error instanceof Error && error.message === 'Insufficient reserved stock') {
      return res.status(400).json({ success: false, message: 'Insufficient reserved stock' });
    }
    logger.error('Error releasing stock', { body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get low stock items
router.get('/alerts/low-stock', async (_req: Request, res: Response) => {
  try {
    const items = await inventoryService.getLowStockItems();
    res.json({ success: true, data: items });
    return;
  } catch (error) {
    logger.error('Error getting low stock items', { error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get out of stock items
router.get('/alerts/out-of-stock', async (_req: Request, res: Response) => {
  try {
    const items = await inventoryService.getOutOfStockItems();
    res.json({ success: true, data: items });
    return;
  } catch (error) {
    logger.error('Error getting out of stock items', { error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get stock alerts
router.get('/alerts', async (_req: Request, res: Response) => {
  try {
    const alerts = await inventoryService.getStockAlerts();
    res.json({ success: true, data: alerts });
    return;
  } catch (error) {
    logger.error('Error getting stock alerts', { error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Acknowledge alert
router.put('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy } = req.body;
    await inventoryService.acknowledgeAlert(alertId, acknowledgedBy || 'system');
    res.json({ success: true, message: 'Alert acknowledged' });
    return;
  } catch (error) {
    logger.error('Error acknowledging alert', { alertId: req.params.alertId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;