import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validateBody, validateQuery } from '../middleware/validate';
import orderService from '../services/orderService';
import logger from '../utils/logger';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zipCode: Joi.string().required(),
  country: Joi.string().required(),
});

const paymentMethodSchema = Joi.object({
  type: Joi.string().valid('credit_card', 'paypal', 'bank_transfer').required(),
  details: Joi.object().required(),
});

const orderItemSchema = Joi.object({
  productId: Joi.string().required(),
  variantId: Joi.string().optional(),
  quantity: Joi.number().integer().min(1).required(),
  unitPrice: Joi.number().precision(2).min(0).required(),
  totalPrice: Joi.number().precision(2).min(0).required(),
});

const createOrderSchema = Joi.object({
  userId: Joi.string().required(),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  shippingAddress: addressSchema.required(),
  billingAddress: addressSchema.optional(),
  paymentMethod: paymentMethodSchema.required(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(
    'created', 'confirmed', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  ).required(),
  notes: Joi.string().optional(),
});

const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

// ── Routes ──────────────────────────────────────────────────────────

// Create order
router.post('/', validateBody(createOrderSchema), async (req: Request, res: Response) => {
  try {
    const order = await orderService.createOrder(req.body);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    logger.error('Error creating order', { body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get order by ID
router.get('/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await orderService.getOrder(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    logger.error('Error getting order', { orderId: req.params.orderId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get user orders
router.get('/user/:userId', validateQuery(paginationSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit, offset } = req.query as any;
    const orders = await orderService.getUserOrders(userId, limit, offset);
    res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Error getting user orders', { userId: req.params.userId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update order status
router.put('/:orderId/status', validateBody(updateStatusSchema), async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    await orderService.updateOrderStatus(orderId, status, req.user?.id, notes);
    res.json({ success: true, message: 'Order status updated' });
  } catch (error) {
    logger.error('Error updating order status', { orderId: req.params.orderId, body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get order status history
router.get('/:orderId/history', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const history = await orderService.getOrderHistory(orderId);
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Error getting order history', { orderId: req.params.orderId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;