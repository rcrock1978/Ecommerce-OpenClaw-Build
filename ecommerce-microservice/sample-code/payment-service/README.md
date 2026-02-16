# Payment Service

A high-performance Go microservice for handling payment processing in the e-commerce platform. Built with security, reliability, and PCI DSS compliance in mind.

## Overview

The Payment Service is responsible for:

- Processing credit card payments via Stripe
- Managing payment statuses and reconciliation
- Handling refunds (full and partial)
- Publishing payment events to Kafka
- Storing payment data in PostgreSQL
- Providing REST API for payment operations

## Architecture

### Tech Stack

- **Language**: Go 1.22
- **Framework**: Gin (HTTP router)
- **Database**: PostgreSQL
- **Message Broker**: Apache Kafka
- **Payment Provider**: Stripe
- **Container**: Docker

### Key Features

- **High Performance**: Sub-millisecond response times
- **Idempotent Operations**: Safe retry of payment operations
- **Event-Driven**: Publishes events for order processing
- **Security**: PCI DSS compliant payment handling
- **Monitoring**: Comprehensive logging and metrics
- **Mock Mode**: Development-friendly Stripe mocking

## Quick Start

### Prerequisites

- Go 1.22+
- Docker & Docker Compose
- PostgreSQL 16+
- Kafka

### Local Development

1. **Clone and setup:**
   ```bash
   cd payment-service
   cp .env.example .env
   ```

2. **Start dependencies:**
   ```bash
   docker compose up -d postgres kafka
   ```

3. **Run the service:**
   ```bash
   go run main.go
   ```

4. **Run tests:**
   ```bash
   go test ./...
   ```

### Docker Development

```bash
# Build and run
docker build -t payment-service .
docker run -p 3005:3005 --env-file .env payment-service
```

## API Documentation

### Authentication

All API endpoints require JWT authentication:

```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### Create Payment
```http
POST /api/v1/payments
Content-Type: application/json

{
  "order_id": "uuid",
  "idempotency_key": "unique-key",
  "payment_method": "card",
  "amount": 99.99,
  "currency": "USD",
  "card": {
    "number": "4242424242424242",
    "exp_month": 12,
    "exp_year": 2026,
    "cvc": "123",
    "holder_name": "John Doe"
  }
}
```

**Response (201):**
```json
{
  "payment": {
    "id": "uuid",
    "order_id": "uuid",
    "status": "succeeded",
    "amount": 99.99,
    "currency": "USD",
    "paid_at": "2026-02-16T12:00:00Z"
  }
}
```

#### Get Payment
```http
GET /api/v1/payments/{id}
```

**Response (200):**
```json
{
  "payment": {
    "id": "uuid",
    "order_id": "uuid",
    "status": "succeeded",
    "amount": 99.99,
    "currency": "USD",
    "payment_method": "card",
    "provider": "stripe",
    "paid_at": "2026-02-16T12:00:00Z",
    "created_at": "2026-02-16T11:59:00Z"
  }
}
```

#### List Payments
```http
GET /api/v1/payments?limit=20&offset=0
```

#### Create Refund
```http
POST /api/v1/payments/{id}/refund
Content-Type: application/json

{
  "idempotency_key": "refund-key-123",
  "amount": 50.00,
  "reason": "customer_request",
  "notes": "Customer changed mind"
}
```

#### Get Refund
```http
GET /api/v1/refunds/{id}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3005` | Server port |
| `NODE_ENV` | `development` | Environment (development/production) |
| `JWT_SECRET` | - | JWT signing secret |
| `DATABASE_URL` | - | PostgreSQL connection URL |
| `KAFKA_BROKERS` | `kafka:29092` | Kafka broker addresses |
| `STRIPE_SECRET_KEY` | - | Stripe secret key |
| `USE_STRIPE_MOCK` | `true` | Use Stripe mock for development |

## Database Schema

### payments table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `order_id` | UUID | Reference to order |
| `user_id` | UUID | User who made payment |
| `idempotency_key` | VARCHAR | Prevents duplicate payments |
| `payment_method` | VARCHAR | card, paypal, etc. |
| `provider` | VARCHAR | stripe, paypal |
| `provider_payment_id` | VARCHAR | External payment ID |
| `currency` | CHAR(3) | ISO currency code |
| `amount` | NUMERIC | Payment amount |
| `status` | VARCHAR | pending, processing, succeeded, failed |
| `paid_at` | TIMESTAMPTZ | When payment succeeded |
| `created_at` | TIMESTAMPTZ | Record creation time |

### refunds table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `payment_id` | UUID | Reference to payment |
| `idempotency_key` | VARCHAR | Prevents duplicate refunds |
| `provider_refund_id` | VARCHAR | External refund ID |
| `amount` | NUMERIC | Refund amount |
| `reason` | VARCHAR | customer_request, defective, etc. |
| `status` | VARCHAR | pending, processing, succeeded, failed |
| `refunded_at` | TIMESTAMPTZ | When refund succeeded |

## Events

The service publishes CloudEvents to Kafka:

### Payment Events

**Topic:** `payment.created`, `payment.succeeded`, `payment.failed`

```json
{
  "specversion": "1.0",
  "type": "com.ecommerce.payment.succeeded",
  "source": "/payment-service",
  "id": "event-uuid",
  "time": "2026-02-16T12:00:00Z",
  "data": {
    "payment_id": "uuid",
    "order_id": "uuid",
    "user_id": "uuid",
    "amount": 99.99,
    "currency": "USD",
    "status": "succeeded",
    "paid_at": "2026-02-16T12:00:00Z"
  }
}
```

### Refund Events

**Topic:** `refund.created`, `refund.succeeded`, `refund.failed`

```json
{
  "specversion": "1.0",
  "type": "com.ecommerce.refund.succeeded",
  "source": "/payment-service",
  "id": "event-uuid",
  "time": "2026-02-16T12:05:00Z",
  "data": {
    "refund_id": "uuid",
    "payment_id": "uuid",
    "amount": 50.00,
    "reason": "customer_request",
    "status": "succeeded",
    "refunded_at": "2026-02-16T12:05:00Z"
  }
}
```

## Security

### PCI DSS Compliance

- **No card data storage**: Cards are tokenized immediately
- **Secure transmission**: All card data encrypted in transit
- **Access controls**: JWT authentication required
- **Audit logging**: All payment operations logged
- **Environment isolation**: Production uses Stripe live mode

### Best Practices

- **Idempotency**: All operations support idempotency keys
- **Rate limiting**: 100 requests/minute per user
- **Input validation**: Strict validation of all inputs
- **Error handling**: Sensitive data never logged
- **Mock mode**: Development uses mock payments

## Testing

### Unit Tests

```bash
go test ./services/
go test ./handlers/
```

### Integration Tests

```bash
# Requires running PostgreSQL and Kafka
go test -tags=integration ./tests/
```

### Test Coverage

```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## Monitoring

### Health Checks

```bash
GET /health
```

### Metrics

- Request latency
- Error rates
- Payment success rates
- Database connection pool stats
- Kafka publishing stats

### Logging

Structured JSON logging with correlation IDs:

```json
{
  "timestamp": "2026-02-16T12:00:00Z",
  "level": "INFO",
  "service": "payment-service",
  "correlation_id": "req-123",
  "method": "POST",
  "path": "/api/v1/payments",
  "status": 201,
  "duration_ms": 45,
  "user_id": "user-uuid"
}
```

## Deployment

### Docker Compose (Development)

```yaml
version: '3.8'
services:
  payment-service:
    build: .
    ports:
      - "3005:3005"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/payments
      - KAFKA_BROKERS=kafka:29092
    depends_on:
      - postgres
      - kafka
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: payment-service
        image: payment-service:latest
        ports:
        - containerPort: 3005
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: payment-secrets
              key: database-url
        - name: STRIPE_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: payment-secrets
              key: stripe-secret-key
```

## Development

### Code Structure

```
payment-service/
├── config/           # Configuration management
├── database/         # Database connection and migrations
├── handlers/         # HTTP request handlers
├── middleware/       # Gin middleware
├── models/           # Data models and DTOs
├── services/         # Business logic
├── tests/           # Test files
├── main.go          # Application entry point
├── Dockerfile       # Container definition
├── docker-compose.yml
├── go.mod
├── go.sum
└── README.md
```

### Contributing

1. **Code Style**: Follow Go conventions and use `gofmt`
2. **Testing**: Write tests for new features
3. **Documentation**: Update README for API changes
4. **Security**: Never log sensitive payment data

### Performance Optimization

- **Connection pooling**: PostgreSQL connection pool
- **Goroutines**: Concurrent request handling
- **Caching**: Redis for session data (future)
- **Database indexes**: Optimized queries
- **Profiling**: Use `go tool pprof` for optimization

## License

This project is part of the NexaCommerce platform.