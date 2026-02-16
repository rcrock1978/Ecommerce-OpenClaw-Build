# Cart Service

Centralized shopping cart management microservice for the e-commerce platform.

## Features

- **Redis-based Storage**: Fast, in-memory cart storage with expiration
- **Cart Operations**: Add, update, remove items
- **Cart Merging**: Merge anonymous session carts with user carts on login
- **Expiration Handling**: Automatic cleanup of inactive anonymous carts
- **REST API**: Full CRUD operations with validation

## Tech Stack

- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: Redis
- **Validation**: Joi
- **Logging**: Winston
- **Testing**: Jest

## API Endpoints

### Get Cart
```
GET /api/cart/:cartId
```

### Add Item
```
POST /api/cart/:cartId/items
Content-Type: application/json

{
  "productId": "string",
  "variantId": "string?", // optional
  "quantity": 1
}
```

### Update Item
```
PUT /api/cart/:cartId/items
Content-Type: application/json

{
  "productId": "string",
  "variantId": "string?", // optional
  "quantity": 0 // 0 to remove
}
```

### Remove Item
```
DELETE /api/cart/:cartId/items/:productId/:variantId?
```

### Clear Cart
```
DELETE /api/cart/:cartId
```

### Merge Carts (Login)
```
POST /api/cart/merge
Content-Type: application/json

{
  "sessionId": "string",
  "userId": "string"
}
```

## Environment Variables

- `PORT`: Service port (default: 3006)
- `NODE_ENV`: Environment (development/production)
- `REDIS_URL`: Redis connection URL (default: redis://localhost:6379)
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
docker build -t cart-service .

# Run container
docker run -p 3006:3006 cart-service
```

## Health Check

```
GET /health
```

Returns service status and timestamp.

## Architecture Notes

- Cart IDs are either session IDs (anonymous) or user IDs (authenticated)
- Anonymous carts expire after 7 days of inactivity
- Cart merging preserves quantities for duplicate items
- All operations are atomic using Redis transactions where needed