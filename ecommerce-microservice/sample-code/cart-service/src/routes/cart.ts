import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validateBody } from '../middleware/validate';
import cartService from '../services/cartService';
import logger from '../utils/logger';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────

const cartIdSchema = Joi.object({
  cartId: Joi.string().required(),
});

const addItemSchema = Joi.object({
  productId: Joi.string().required(),
  variantId: Joi.string().optional(),
  quantity: Joi.number().integer().min(1).required(),
});

const updateItemSchema = Joi.object({
  productId: Joi.string().required(),
  variantId: Joi.string().optional(),
  quantity: Joi.number().integer().min(0).required(),
});

const mergeCartSchema = Joi.object({
  sessionId: Joi.string().required(),
  userId: Joi.string().required(),
});

// ── Routes ──────────────────────────────────────────────────────────

// Get cart
router.get('/:cartId', async (req: Request, res: Response) => {
  try {
    const { cartId } = req.params;
    const cart = await cartService.getCart(cartId);

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    res.json({ success: true, data: cart });
  } catch (error) {
    logger.error('Error getting cart', { cartId: req.params.cartId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Add item to cart
router.post('/:cartId/items', validateBody(addItemSchema), async (req: Request, res: Response) => {
  try {
    const { cartId } = req.params;
    const operation = req.body;
    const cart = await cartService.addItem(cartId, operation);
    res.json({ success: true, data: cart });
  } catch (error) {
    logger.error('Error adding item to cart', { cartId: req.params.cartId, body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update item in cart
router.put('/:cartId/items', validateBody(updateItemSchema), async (req: Request, res: Response) => {
  try {
    const { cartId } = req.params;
    const operation = req.body;
    const cart = await cartService.updateItem(cartId, operation);
    res.json({ success: true, data: cart });
  } catch (error) {
    if (error instanceof Error && error.message === 'Cart not found') {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }
    if (error instanceof Error && error.message === 'Item not found in cart') {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }
    logger.error('Error updating item in cart', { cartId: req.params.cartId, body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Remove item from cart
router.delete('/:cartId/items/:productId/:variantId?', async (req: Request, res: Response) => {
  try {
    const { cartId, productId, variantId } = req.params;
    const cart = await cartService.removeItem(cartId, productId, variantId);
    res.json({ success: true, data: cart });
  } catch (error) {
    if (error instanceof Error && error.message === 'Cart not found') {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }
    logger.error('Error removing item from cart', { cartId, productId, variantId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Clear cart
router.delete('/:cartId', async (req: Request, res: Response) => {
  try {
    const { cartId } = req.params;
    await cartService.clearCart(cartId);
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    logger.error('Error clearing cart', { cartId: req.params.cartId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Merge carts (for login)
router.post('/merge', validateBody(mergeCartSchema), async (req: Request, res: Response) => {
  try {
    const { sessionId, userId } = req.body;
    const cart = await cartService.mergeCarts(sessionId, userId);
    res.json({ success: true, data: cart });
  } catch (error) {
    if (error instanceof Error && error.message === 'Session cart not found') {
      return res.status(404).json({ success: false, message: 'Session cart not found' });
    }
    logger.error('Error merging carts', { body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;