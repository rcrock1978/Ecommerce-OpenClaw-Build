import { Router, Response } from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { findById, updateUser, listUsers } from '../models/user';
import { AuthenticatedRequest, UserRole } from '../types';
import logger from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// ── GET /me ─────────────────────────────────────────────────────────

router.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err) {
    logger.error('Failed to fetch profile', { error: (err as Error).message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PUT /me ─────────────────────────────────────────────────────────

router.put('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { first_name, last_name, email } = req.body;
    const updated = await updateUser(req.user!.userId, { first_name, last_name, email });

    if (!updated) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('Failed to update profile', { error: (err as Error).message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /users (admin, paginated) ───────────────────────────────────

router.get(
  '/',
  authorize(UserRole.ADMIN),
  validateQuery(paginationSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const { users, total } = await listUsers(page, limit);

      res.json({
        success: true,
        data: users,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      logger.error('Failed to list users', { error: (err as Error).message });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

// ── GET /users/:id (admin) ──────────────────────────────────────────

router.get(
  '/:id',
  authorize(UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await findById(req.params.id);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      res.json({ success: true, data: user });
    } catch (err) {
      logger.error('Failed to fetch user', { error: (err as Error).message });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

export default router;
