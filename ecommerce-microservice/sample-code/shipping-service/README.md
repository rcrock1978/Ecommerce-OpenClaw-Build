# Shipping Service

Logistics and fulfillment microservice for the e-commerce platform.

## Features

- **Shipping Methods**: Multiple carriers and delivery options
- **Shipment Tracking**: Real-time status updates and tracking numbers
- **Cost Calculation**: Dynamic shipping cost calculation
- **Status History**: Complete shipment lifecycle tracking
- **Carrier Integration**: Ready for carrier API integration
- **Kafka Events**: Event-driven shipment updates

## Tech Stack

- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Message Queue**: Kafka
- **Validation**: Joi
- **Logging**: Winston

## Shipment Status Flow

```
pending → processing → shipped → in_transit → out_for_delivery → delivered
    ↓         ↓         ↓         ↓            ↓              ↓
 failed    failed    failed    failed       failed        returned
```

## API Endpoints

### Create Shipping Method (Admin)
```
POST /api/shipping/methods
Content-Type: application/json

{
  "name": "Standard Shipping",
  "description": "3-5 business days",
  "carrier": "USPS",
  "estimatedDaysMin": 3,
  "estimatedDaysMax": 5,
  "cost": 5.99
}
```

### Get Shipping Methods
```
GET /api/shipping/methods
```

### Create Shipment
```
POST /api/shipping
Content-Type: application/json

{
  "orderId": "order-123",
  "shippingMethodId": "method-456",
  "weightKg": 2.5,
  "dimensions": {
    "length": 30,
    "width": 20,
    "height": 10
  },
  "destinationAddress": {
    "street": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "zipCode": "12345",
    "country": "USA"
  }
}
```

### Get Shipment
```
GET /api/shipping/:id
```

### Get Shipment by Order ID
```
GET /api/shipping/order/:orderId
```

### Update Shipment Status
```
PUT /api/shipping/:id/status
Content-Type: application/json

{
  "status": "shipped",
  "trackingNumber": "1Z999AA1234567890",
  "notes": "Package shipped via UPS"
}
```

### Get Shipment History
```
GET /api/shipping/:id/history
```

### Calculate Shipping Cost
```
POST /api/shipping/calculate-cost
Content-Type: application/json

{
  "weightKg": 2.5,
  "destination": "US"
}
```

## Kafka Events

The service publishes the following events:

- `shipment.created` - When a shipment is created
- `shipment.status.changed` - When shipment status changes
- `shipment.shipped` - When shipment is shipped
- `shipment.delivered` - When shipment is delivered

## Environment Variables

- `PORT`: Service port (default: 3010)
- `NODE_ENV`: Environment (development/production)
- `DATABASE_URL`: PostgreSQL connection URL
- `KAFKA_BROKERS`: Kafka brokers (comma-separated)
- `LOG_LEVEL`: Logging level (default: info/debug)

## Database Schema

Shipping data is stored in PostgreSQL with the following tables:

- `shipping_methods` - Available shipping options
- `shipments` - Shipment details and status
- `shipment_status_history` - Audit trail of status changes

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
docker build -t shipping-service .

# Run container
docker run -p 3010:3010 shipping-service
```

## Health Check

```
GET /health
```

Returns service status and timestamp.

## Architecture Notes

- Uses database transactions for status updates
- Status history provides complete audit trail
- Carrier integration points ready for APIs (FedEx, UPS, etc.)
- Cost calculation is mock - integrate with carrier pricing APIs