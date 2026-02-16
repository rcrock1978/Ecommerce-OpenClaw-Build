import nodemailer from 'nodemailer';
import { EmailConfig } from '../types';
import logger from '../utils/logger';

let transporter: nodemailer.Transporter;

export function createEmailTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
      },
      from: process.env.SMTP_FROM ?? 'noreply@ecommerce.com',
    };

    transporter = nodemailer.createTransporter(config);
    logger.info('Email transporter created');
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const transporter = createEmailTransporter();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
    logger.info('Email sent', { to, subject });
  } catch (error) {
    logger.error('Failed to send email', { to, subject, error });
    throw error;
  }
}