# Order Service

Order processing and management microservice for the e-commerce platform.

## Features

- **Order Lifecycle Management**: Complete order processing from creation to delivery
- **PostgreSQL Storage**: Persistent order data with transactions
- **Kafka Integration**: Event-driven order status updates
- **REST API**: Full CRUD operations with validation
- **Status Tracking**: Comprehensive order history and status changes

## Tech Stack

- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Message Queue**: Kafka
- **Validation**: Joi
- **Logging**: Winston

## Order Status Flow

```
created → confirmed → paid → processing → shipped → delivered
    ↓         ↓         ↓         ↓         ↓         ↓
cancelled  cancelled  refunded   cancelled  cancelled
```

## API Endpoints

### Create Order
```
POST /api/orders
Content-Type: application/json

{
  "userId": "string",
  "items": [{
    "productId": "string",
    "variantId": "string?",
    "quantity": 1,
    "unitPrice": 29.99,
    "totalPrice": 29.99
  }],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "zipCode": "12345",
    "country": "USA"
  },
  "billingAddress": { ... }, // optional, defaults to shipping
  "paymentMethod": {
    "type": "credit_card",
    "details": { "last4": "1234", ... }
  }
}
```

### Get Order
```
GET /api/orders/:orderId
```

### Get User Orders
```
GET /api/orders/user/:userId?limit=50&offset=0
```

### Update Order Status
```
PUT /api/orders/:orderId/status
Content-Type: application/json

{
  "status": "paid",
  "notes": "Payment received via Stripe"
}
```

### Get Order History
```
GET /api/orders/:orderId/history
```

## Kafka Events

The service publishes the following events:

- `order.created` - When an order is created
- `order.status.changed` - When order status changes
- `order.paid` - When order is paid
- `order.shipped` - When order is shipped
- `order.delivered` - When order is delivered
- `order.cancelled` - When order is cancelled

## Environment Variables

- `PORT`: Service port (default: 3004)
- `NODE_ENV`: Environment (development/production)
- `DATABASE_URL`: PostgreSQL connection URL
- `KAFKA_BROKERS`: Kafka brokers (comma-separated)
- `LOG_LEVEL`: Logging level (default: info/debug)

## Database Schema

Orders are stored in PostgreSQL with the following tables:

- `orders` - Order header information
- `order_items` - Individual order line items
- `order_status_history` - Audit trail of status changes
- `migrations` - Database migration tracking

## Development

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

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
docker build -t order-service .

# Run container
docker run -p 3004:3004 order-service
```

## Health Check

```
GET /health
```

Returns service status and timestamp.

## Architecture Notes

- Uses database transactions for order creation
- Publishes events for other services to consume
- Maintains complete audit trail of status changes
- Supports pagination for user order history