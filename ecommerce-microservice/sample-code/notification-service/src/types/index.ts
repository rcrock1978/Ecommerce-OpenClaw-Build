export interface Notification {
  id?: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string;
  message: string;
  metadata?: Record<string, any>;
  sentAt?: Date;
  status: NotificationStatus;
}

export type NotificationType =
  | 'order_confirmation'
  | 'order_shipped'
  | 'order_delivered'
  | 'password_reset'
  | 'welcome'
  | 'custom';

export type NotificationChannel = 'email' | 'sms';

export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface SMSConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}