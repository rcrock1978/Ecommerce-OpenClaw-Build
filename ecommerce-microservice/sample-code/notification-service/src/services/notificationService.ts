import { sendEmail } from '../config/email';
import { sendSMS } from '../config/sms';
import { Notification, SendNotificationRequest, NotificationChannel } from '../types';
import logger from '../utils/logger';

export class NotificationService {
  async sendNotification(request: SendNotificationRequest): Promise<void> {
    const notification: Notification = {
      userId: request.userId,
      type: request.type,
      channel: request.channel,
      subject: request.subject,
      message: request.message,
      metadata: request.metadata,
      status: 'pending',
    };

    try {
      if (request.channel === 'email') {
        await this.sendEmailNotification(notification);
      } else if (request.channel === 'sms') {
        await this.sendSMSNotification(notification);
      }

      notification.status = 'sent';
      notification.sentAt = new Date();

      logger.info('Notification sent', {
        userId: request.userId,
        type: request.type,
        channel: request.channel,
      });
    } catch (error) {
      notification.status = 'failed';
      logger.error('Failed to send notification', {
        userId: request.userId,
        type: request.type,
        channel: request.channel,
        error,
      });
      throw error;
    }
  }

  private async sendEmailNotification(notification: Notification): Promise<void> {
    // In production, get user email from user service
    const userEmail = await this.getUserEmail(notification.userId);

    await sendEmail(userEmail, notification.subject, notification.message);
  }

  private async sendSMSNotification(notification: Notification): Promise<void> {
    // In production, get user phone from user service
    const userPhone = await this.getUserPhone(notification.userId);

    await sendSMS(userPhone, notification.message);
  }

  // Mock methods - in production, call user service
  private async getUserEmail(userId: string): Promise<string> {
    // Mock implementation
    return `user${userId}@example.com`;
  }

  private async getUserPhone(userId: string): Promise<string> {
    // Mock implementation
    return '+1234567890';
  }

  // Event handlers for Kafka consumers
  async handleOrderCreated(data: any): Promise<void> {
    await this.sendNotification({
      userId: data.userId,
      type: 'order_confirmation',
      channel: 'email',
      subject: 'Order Confirmation',
      message: `Your order ${data.orderId} has been confirmed. Total: $${data.totalAmount}`,
      metadata: { orderId: data.orderId },
    });
  }

  async handleOrderShipped(data: any): Promise<void> {
    await this.sendNotification({
      userId: data.userId,
      type: 'order_shipped',
      channel: 'email',
      subject: 'Order Shipped',
      message: `Your order ${data.orderId} has been shipped.`,
      metadata: { orderId: data.orderId },
    });
  }

  async handleOrderDelivered(data: any): Promise<void> {
    await this.sendNotification({
      userId: data.userId,
      type: 'order_delivered',
      channel: 'email',
      subject: 'Order Delivered',
      message: `Your order ${data.orderId} has been delivered.`,
      metadata: { orderId: data.orderId },
    });
  }

  async handlePasswordReset(data: any): Promise<void> {
    await this.sendNotification({
      userId: data.userId,
      type: 'password_reset',
      channel: 'email',
      subject: 'Password Reset',
      message: `Click here to reset your password: ${data.resetLink}`,
      metadata: { resetToken: data.resetToken },
    });
  }
}

export default new NotificationService();