# Inventory Service

Stock management and inventory tracking microservice for the e-commerce platform.

## Features

- **Stock Tracking**: Real-time inventory levels per product/variant
- **Stock Reservations**: Reserve stock for orders to prevent overselling
- **Low Stock Alerts**: Automatic alerts for low or out-of-stock items
- **Inventory Movements**: Complete audit trail of stock changes
- **Kafka Integration**: Event-driven inventory updates
- **REST API**: Full CRUD operations with validation

## Tech Stack

- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Message Queue**: Kafka
- **Validation**: Joi
- **Logging**: Winston

## API Endpoints

### Create Inventory Item
```
POST /api/inventory
Content-Type: application/json

{
  "productId": "string",
  "variantId": "string?", // optional
  "sku": "string",
  "quantityAvailable": 100,
  "lowStockThreshold": 10,
  "location": "string?"
}
```

### Get Inventory Item
```
GET /api/inventory/:id
```

### Get Inventory by Product
```
GET /api/inventory/product/:productId?variantId=...
```

### Get Inventory by SKU
```
GET /api/inventory/sku/:sku
```

### Update Inventory
```
PUT /api/inventory/:id
Content-Type: application/json

{
  "quantityAvailable": 150,
  "lowStockThreshold": 15,
  "location": "Warehouse A"
}
```

### Reserve Stock
```
POST /api/inventory/reserve
Content-Type: application/json

{
  "productId": "string",
  "variantId": "string?",
  "quantity": 2,
  "referenceId": "order-123",
  "referenceType": "order",
  "notes": "Order reservation"
}
```

### Release Stock
```
POST /api/inventory/release
Content-Type: application/json

{
  "productId": "string",
  "variantId": "string?",
  "quantity": 2,
  "referenceId": "order-123",
  "referenceType": "order",
  "notes": "Order cancelled"
}
```

### Get Low Stock Items
```
GET /api/inventory/alerts/low-stock
```

### Get Out of Stock Items
```
GET /api/inventory/alerts/out-of-stock
```

### Get Stock Alerts
```
GET /api/inventory/alerts
```

### Acknowledge Alert
```
PUT /api/inventory/alerts/:alertId/acknowledge
Content-Type: application/json

{
  "acknowledgedBy": "user-123"
}
```

## Kafka Events

The service publishes the following events:

- `inventory.created` - When inventory item is created
- `inventory.updated` - When inventory is updated
- `inventory.reserved` - When stock is reserved
- `inventory.released` - When stock is released

## Environment Variables

- `PORT`: Service port (default: 3003)
- `NODE_ENV`: Environment (development/production)
- `DATABASE_URL`: PostgreSQL connection URL
- `KAFKA_BROKERS`: Kafka brokers (comma-separated)
- `LOG_LEVEL`: Logging level (default: info/debug)

## Database Schema

Inventory data is stored in PostgreSQL with the following tables:

- `inventory` - Current stock levels and settings
- `inventory_movements` - Audit trail of all stock changes
- `stock_alerts` - Low stock and out-of-stock alerts
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
docker build -t inventory-service .

# Run container
docker run -p 3003:3003 inventory-service
```

## Health Check

```
GET /health
```

Returns service status and timestamp.

## Architecture Notes

- Uses database transactions for stock operations
- Automatic alert generation for stock thresholds
- Complete audit trail for all inventory movements
- Event-driven integration with order processing