import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validateBody } from '../middleware/validate';
import shippingService from '../services/shippingService';
import logger from '../utils/logger';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────

const shippingMethodSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  carrier: Joi.string().optional(),
  estimatedDaysMin: Joi.number().integer().min(1).optional(),
  estimatedDaysMax: Joi.number().integer().min(1).optional(),
  cost: Joi.number().precision(2).min(0).required(),
  isActive: Joi.boolean().default(true),
});

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zipCode: Joi.string().required(),
  country: Joi.string().required(),
});

const dimensionsSchema = Joi.object({
  length: Joi.number().precision(2).min(0).required(),
  width: Joi.number().precision(2).min(0).required(),
  height: Joi.number().precision(2).min(0).required(),
});

const createShipmentSchema = Joi.object({
  orderId: Joi.string().required(),
  shippingMethodId: Joi.string().required(),
  weightKg: Joi.number().precision(2).min(0).optional(),
  dimensions: dimensionsSchema.optional(),
  originAddress: addressSchema.optional(),
  destinationAddress: addressSchema.required(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(
    'pending', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'
  ).required(),
  trackingNumber: Joi.string().optional(),
  notes: Joi.string().optional(),
  location: Joi.string().optional(),
});

// ── Routes ──────────────────────────────────────────────────────────

// Create shipping method (admin)
router.post('/methods', validateBody(shippingMethodSchema), async (req: Request, res: Response) => {
  try {
    const method = await shippingService.createShippingMethod(req.body);
    res.status(201).json({ success: true, data: method });
  } catch (error) {
    logger.error('Error creating shipping method', { body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get shipping methods
router.get('/methods', async (req: Request, res: Response) => {
  try {
    const methods = await shippingService.getShippingMethods();
    res.json({ success: true, data: methods });
  } catch (error) {
    logger.error('Error getting shipping methods', { error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get shipping method
router.get('/methods/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const method = await shippingService.getShippingMethod(id);

    if (!method) {
      return res.status(404).json({ success: false, message: 'Shipping method not found' });
    }

    res.json({ success: true, data: method });
  } catch (error) {
    logger.error('Error getting shipping method', { id: req.params.id, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Create shipment
router.post('/', validateBody(createShipmentSchema), async (req: Request, res: Response) => {
  try {
    const shipment = await shippingService.createShipment(req.body);
    res.status(201).json({ success: true, data: shipment });
  } catch (error) {
    if (error instanceof Error && error.message === 'Shipping method not found') {
      return res.status(400).json({ success: false, message: 'Shipping method not found' });
    }
    logger.error('Error creating shipment', { body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get shipment
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shipment = await shippingService.getShipment(id);

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    res.json({ success: true, data: shipment });
  } catch (error) {
    logger.error('Error getting shipment', { id: req.params.id, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get shipment by order ID
router.get('/order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const shipment = await shippingService.getShipmentByOrderId(orderId);

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    res.json({ success: true, data: shipment });
  } catch (error) {
    logger.error('Error getting shipment by order ID', { orderId: req.params.orderId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update shipment status
router.put('/:id/status', validateBody(updateStatusSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, notes, location } = req.body;
    await shippingService.updateShipmentStatus(id, status, trackingNumber, notes, location);
    res.json({ success: true, message: 'Shipment status updated' });
  } catch (error) {
    logger.error('Error updating shipment status', { id: req.params.id, body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get shipment history
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await shippingService.getShipmentHistory(id);
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Error getting shipment history', { id: req.params.id, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Calculate shipping cost
router.post('/calculate-cost', async (req: Request, res: Response) => {
  try {
    const { weightKg, destination } = req.body;
    const cost = await shippingService.calculateShippingCost(weightKg, destination);
    res.json({ success: true, data: { cost } });
  } catch (error) {
    logger.error('Error calculating shipping cost', { body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;