import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validateBody } from '../middleware/validate';
import notificationService from '../services/notificationService';
import logger from '../utils/logger';

const router = Router();

const sendNotificationSchema = Joi.object({
  userId: Joi.string().required(),
  type: Joi.string().valid(
    'order_confirmation', 'order_shipped', 'order_delivered', 'password_reset', 'welcome', 'custom'
  ).required(),
  channel: Joi.string().valid('email', 'sms').required(),
  subject: Joi.string().required(),
  message: Joi.string().required(),
  metadata: Joi.object().optional(),
});

// Send notification manually
router.post('/send', validateBody(sendNotificationSchema), async (req: Request, res: Response) => {
  try {
    await notificationService.sendNotification(req.body);
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    logger.error('Error sending notification', { body: req.body, error });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;