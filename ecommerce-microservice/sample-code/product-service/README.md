# Product Service

The Product Service is a microservice responsible for managing product catalogs, categories, and search functionality in the e-commerce platform.

## Features

- **Product Management**: CRUD operations for products with variants, pricing, and media
- **Category Management**: Hierarchical category system with nested categories
- **Search & Discovery**: Full-text search with Elasticsearch integration
- **Inventory Integration**: Links with inventory service for stock management
- **Event-Driven**: Publishes events for product lifecycle changes
- **Caching**: Redis-based caching for improved performance
- **Observability**: Comprehensive logging, metrics, and tracing

## Architecture

### Tech Stack

- **Runtime**: Node.js 20 with TypeScript
- **Framework**: Express.js with middleware ecosystem
- **Database**: MongoDB for product data
- **Search**: Elasticsearch for full-text search
- **Cache**: Redis for caching
- **Message Queue**: Kafka for events
- **Observability**: Winston (logging), Prometheus (metrics), Jaeger (tracing)

### Key Components

- **Models**: Mongoose schemas for Product and Category
- **Services**: Business logic layer (ProductService, SearchService, etc.)
- **Routes**: REST API endpoints with validation
- **Middleware**: Authentication, rate limiting, metrics, tracing
- **Utils**: Error handling, async wrappers, logging

## API Endpoints

### Products

- `GET /api/v1/products` - List products with filtering and pagination
- `POST /api/v1/products` - Create new product
- `GET /api/v1/products/:id` - Get product by ID or SKU
- `PUT /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Delete product

### Categories

- `GET /api/v1/categories/tree` - Get category hierarchy
- `GET /api/v1/categories` - List categories
- `POST /api/v1/categories` - Create category
- `GET /api/v1/categories/:id` - Get category
- `PUT /api/v1/categories/:id` - Update category
- `DELETE /api/v1/categories/:id` - Delete category

### Search

- `GET /api/v1/search` - Search products
- `GET /api/v1/search/suggestions` - Get search suggestions
- `GET /api/v1/search/filters` - Get available filter options

## Development

### Prerequisites

- Node.js 20+
- MongoDB
- Elasticsearch
- Redis
- Kafka (optional for development)

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository>
   cd product-service
   npm install
   ```

2. **Environment configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start dependencies (using Docker Compose):**
   ```bash
   cd ..
   docker-compose up -d mongodb elasticsearch redis
   ```

4. **Run database migrations:**
   ```bash
   npm run migrate
   ```

5. **Seed initial data:**
   ```bash
   npm run seed
   ```

6. **Start development server:**
   ```bash
   npm run dev
   ```

The service will be available at `http://localhost:3002`

### Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:cov
```

### Docker Development

```bash
# Build image
docker build -t product-service .

# Run with dependencies
docker-compose up product-service
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3002` |
| `MONGODB_URL` | MongoDB connection URL | `mongodb://localhost:27017/productdb` |
| `ELASTICSEARCH_URL` | Elasticsearch URL | `http://localhost:9200` |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | Required |
| `LOG_LEVEL` | Logging level | `info` |
| `JAEGER_ENDPOINT` | Jaeger endpoint | `http://jaeger-collector:14268/api/traces` |

## Monitoring

### Health Checks

- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /metrics` - Prometheus metrics

### Logging

Structured JSON logging with correlation IDs:

```json
{
  "timestamp": "2026-02-16T10:30:00.000Z",
  "service": "product-service",
  "level": "info",
  "message": "Product created successfully",
  "correlationId": "req-12345678-abcd-efgh",
  "productId": "507f1f77bcf86cd799439011"
}
```

### Metrics

Prometheus metrics exposed at `/metrics`:

- HTTP request duration and count
- Database query metrics
- Cache hit/miss ratios
- Business metrics (products created, viewed, etc.)

### Tracing

Distributed tracing with Jaeger:

- Automatic instrumentation for HTTP, MongoDB, Redis
- Custom spans for business logic
- Correlation IDs propagated through requests

## Deployment

### Docker

```bash
# Build production image
docker build -t product-service:latest .

# Run container
docker run -p 3002:3002 \
  -e MONGODB_URL=mongodb://host:27017/productdb \
  -e REDIS_URL=redis://host:6379 \
  product-service:latest
```

### Kubernetes

See the `/k8s` directory for Kubernetes manifests including:

- Deployment with rolling updates
- Service and Ingress
- ConfigMaps and Secrets
- Horizontal Pod Autoscaling
- Health checks and probes

## API Documentation

API documentation is available via OpenAPI/Swagger at `/api/docs` when running the service.

## Contributing

1. Follow the existing code style and patterns
2. Write tests for new features
3. Update documentation for API changes
4. Ensure all tests pass before submitting PR

## License

MIT License