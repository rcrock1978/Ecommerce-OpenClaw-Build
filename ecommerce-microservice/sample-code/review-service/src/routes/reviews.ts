import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validateBody, validateQuery } from '../middleware/validate';
import reviewService from '../services/reviewService';
import logger from '../utils/logger';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────

const createReviewSchema = Joi.object({
  productId: Joi.string().required(),
  userId: Joi.string().required(),
  orderId: Joi.string().optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  title: Joi.string().required(),
  comment: Joi.string().required(),
  images: Joi.array().items(Joi.string()).optional(),
});

const updateReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional(),
  title: Joi.string().optional(),
  comment: Joi.string().optional(),
  images: Joi.array().items(Joi.string()).optional(),
});

const reviewFiltersSchema = Joi.object({
  verified: Joi.boolean().optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
  moderated: Joi.boolean().optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
  sortBy: Joi.string().valid('createdAt', 'rating', 'helpful').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const moderateReviewSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  notes: Joi.string().optional(),
});

// ── Routes ──────────────────────────────────────────────────────────

// Create review
router.post('/', validateBody(createReviewSchema), async (req: Request, res: Response) => {
  try {
    const review = await reviewService.createReview(req.body);
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    if (error instanceof Error && error.message === 'User has already reviewed this product') {
      return res.status(409).json({ success: false, message: 'User has already reviewed this product' });
    }
    logger.error('Error creating review', { body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get review by ID
router.get('/:reviewId', async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const review = await reviewService.getReview(reviewId);

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    res.json({ success: true, data: review });
  } catch (error) {
    logger.error('Error getting review', { reviewId: req.params.reviewId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update review
router.put('/:reviewId', validateBody(updateReviewSchema), async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { userId } = req.body; // Assume userId comes from auth middleware
    const review = await reviewService.updateReview(reviewId, userId, req.body);
    res.json({ success: true, data: review });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    if (error instanceof Error && error.message.includes('moderated')) {
      return res.status(400).json({ success: false, message: 'Cannot update moderated review' });
    }
    logger.error('Error updating review', { reviewId: req.params.reviewId, body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Delete review
router.delete('/:reviewId', async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { userId } = req.body; // Assume from auth
    await reviewService.deleteReview(reviewId, userId);
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    logger.error('Error deleting review', { reviewId: req.params.reviewId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get product reviews
router.get('/product/:productId', validateQuery(reviewFiltersSchema), async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const filters = req.query as any;
    const reviews = await reviewService.getProductReviews(productId, filters);
    res.json({ success: true, data: reviews });
  } catch (error) {
    logger.error('Error getting product reviews', { productId: req.params.productId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get product rating summary
router.get('/product/:productId/summary', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const summary = await reviewService.getProductRatingSummary(productId);
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Error getting rating summary', { productId: req.params.productId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Moderate review (admin)
router.put('/:reviewId/moderate', validateBody(moderateReviewSchema), async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { status, notes } = req.body;
    await reviewService.moderateReview(reviewId, status, notes);
    res.json({ success: true, message: 'Review moderated' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Review not found') {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    logger.error('Error moderating review', { reviewId: req.params.reviewId, body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Mark review as helpful
router.post('/:reviewId/helpful', async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    await reviewService.markHelpful(reviewId);
    res.json({ success: true, message: 'Review marked as helpful' });
  } catch (error) {
    logger.error('Error marking review helpful', { reviewId: req.params.reviewId, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;