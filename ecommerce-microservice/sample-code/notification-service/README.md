# Notification Service

User communications and notifications microservice for the e-commerce platform.

## Features

- **Multi-Channel Notifications**: Email and SMS support
- **Event-Driven**: Kafka consumers for automatic notifications
- **Order Notifications**: Confirmations, shipping updates, delivery confirmations
- **User Communications**: Password resets, welcome messages
- **REST API**: Manual notification sending
- **Extensible**: Easy to add new notification types

## Tech Stack

- **Language**: TypeScript
- **Framework**: Express.js
- **Message Queue**: Kafka
- **Email**: Nodemailer
- **SMS**: Mock implementation (integrate with Twilio/AWS SNS)
- **Validation**: Joi
- **Logging**: Winston

## API Endpoints

### Send Notification Manually
```
POST /api/notifications/send
Content-Type: application/json

{
  "userId": "string",
  "type": "order_confirmation",
  "channel": "email",
  "subject": "Order Confirmation",
  "message": "Your order has been confirmed",
  "metadata": {}
}
```

Supported types: `order_confirmation`, `order_shipped`, `order_delivered`, `password_reset`, `welcome`, `custom`

Channels: `email`, `sms`

## Kafka Events

The service consumes the following events:

- `order.created` → Order confirmation email
- `order.shipped` → Shipping notification email
- `order.delivered` → Delivery confirmation email
- `user.password_reset` → Password reset email

## Environment Variables

- `PORT`: Service port (default: 3007)
- `NODE_ENV`: Environment (development/production)
- `KAFKA_BROKERS`: Kafka brokers (comma-separated)
- `SMTP_HOST`: SMTP server host
- `SMTP_PORT`: SMTP server port
- `SMTP_SECURE`: Use TLS (true/false)
- `SMTP_USER`: SMTP authentication user
- `SMTP_PASS`: SMTP authentication password
- `SMTP_FROM`: From email address
- `LOG_LEVEL`: Logging level (default: info/debug)

## Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run linting
npm run lint
```

## Docker

```bash
# Build image
docker build -t notification-service .

# Run container
docker run -p 3007:3007 notification-service
```

## Health Check

```
GET /health
```

Returns service status and timestamp.

## Architecture Notes

- Event-driven architecture with Kafka consumers
- Mock SMS implementation - integrate with real SMS provider
- Email templates can be added for better formatting
- User contact info should be fetched from user service in production