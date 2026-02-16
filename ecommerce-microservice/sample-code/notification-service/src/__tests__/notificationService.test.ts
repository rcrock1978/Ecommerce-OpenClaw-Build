import { jest } from '@jest/globals';
import { NotificationService } from '../services/notificationService';

// Mock dependencies
jest.mock('../config/email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('../config/sms', () => ({
  sendSMS: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { sendEmail } from '../config/email';
import { sendSMS } from '../config/sms';
import logger from '../utils/logger';

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    notificationService = new NotificationService();
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should send email notification successfully', async () => {
      const request = {
        userId: 'user-123',
        type: 'test',
        channel: 'email' as const,
        subject: 'Test Subject',
        message: 'Test Message',
        metadata: { key: 'value' },
      };

      (sendEmail as jest.Mock).mockResolvedValue(undefined);

      await notificationService.sendNotification(request);

      expect(sendEmail).toHaveBeenCalledWith('useruser-123@example.com', 'Test Subject', 'Test Message');
      expect(logger.default.info).toHaveBeenCalledWith('Notification sent', {
        userId: 'user-123',
        type: 'test',
        channel: 'email',
      });
    });

    it('should send SMS notification successfully', async () => {
      const request = {
        userId: 'user-456',
        type: 'alert',
        channel: 'sms' as const,
        subject: 'Alert',
        message: 'Alert message',
      };

      (sendSMS as jest.Mock).mockResolvedValue(undefined);

      await notificationService.sendNotification(request);

      expect(sendSMS).toHaveBeenCalledWith('+1234567890', 'Alert message');
      expect(logger.default.info).toHaveBeenCalledWith('Notification sent', {
        userId: 'user-456',
        type: 'alert',
        channel: 'sms',
      });
    });

    it('should handle email sending failure', async () => {
      const request = {
        userId: 'user-123',
        type: 'test',
        channel: 'email' as const,
        subject: 'Test Subject',
        message: 'Test Message',
      };

      const error = new Error('Email service unavailable');
      (sendEmail as jest.Mock).mockRejectedValue(error);

      await expect(notificationService.sendNotification(request)).rejects.toThrow(error);

      expect(logger.default.error).toHaveBeenCalledWith('Failed to send notification', {
        userId: 'user-123',
        type: 'test',
        channel: 'email',
        error,
      });
    });

    it('should handle SMS sending failure', async () => {
      const request = {
        userId: 'user-456',
        type: 'alert',
        channel: 'sms' as const,
        subject: 'Alert',
        message: 'Alert message',
      };

      const error = new Error('SMS service unavailable');
      (sendSMS as jest.Mock).mockRejectedValue(error);

      await expect(notificationService.sendNotification(request)).rejects.toThrow(error);

      expect(logger.default.error).toHaveBeenCalledWith('Failed to send notification', {
        userId: 'user-456',
        type: 'alert',
        channel: 'sms',
        error,
      });
    });
  });

  describe('Event handlers', () => {
    beforeEach(() => {
      (sendEmail as jest.Mock).mockResolvedValue(undefined);
    });

    it('should handle order created event', async () => {
      const data = {
        userId: 'user-123',
        orderId: 'order-456',
        totalAmount: 99.99,
      };

      await notificationService.handleOrderCreated(data);

      expect(sendEmail).toHaveBeenCalledWith(
        'useruser-123@example.com',
        'Order Confirmation',
        'Your order order-456 has been confirmed. Total: $99.99'
      );
    });

    it('should handle order shipped event', async () => {
      const data = {
        userId: 'user-123',
        orderId: 'order-456',
      };

      await notificationService.handleOrderShipped(data);

      expect(sendEmail).toHaveBeenCalledWith(
        'useruser-123@example.com',
        'Order Shipped',
        'Your order order-456 has been shipped.'
      );
    });

    it('should handle order delivered event', async () => {
      const data = {
        userId: 'user-123',
        orderId: 'order-456',
      };

      await notificationService.handleOrderDelivered(data);

      expect(sendEmail).toHaveBeenCalledWith(
        'useruser-123@example.com',
        'Order Delivered',
        'Your order order-456 has been delivered.'
      );
    });

    it('should handle password reset event', async () => {
      const data = {
        userId: 'user-123',
        resetToken: 'reset-token-456',
        resetLink: 'https://example.com/reset?token=reset-token-456',
      };

      await notificationService.handlePasswordReset(data);

      expect(sendEmail).toHaveBeenCalledWith(
        'useruser-123@example.com',
        'Password Reset',
        'Click here to reset your password: https://example.com/reset?token=reset-token-456'
      );
    });
  });

  describe('Private methods', () => {
    it('should get user email', async () => {
      // Access private method through type assertion
      const service = notificationService as any;
      const email = await service.getUserEmail('user-123');

      expect(email).toBe('useruser-123@example.com');
    });

    it('should get user phone', async () => {
      const service = notificationService as any;
      const phone = await service.getUserPhone('user-456');

      expect(phone).toBe('+1234567890');
    });
  });
});