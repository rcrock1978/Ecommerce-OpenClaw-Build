# 06 — Event-Driven Architecture

## Overview

This document defines the event-driven architecture for the e-commerce microservice platform, including Kafka topics, event schemas, and asynchronous processing patterns. The platform uses events for decoupling services, enabling eventual consistency, and supporting complex workflows across bounded contexts.

---

## Event Streaming Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Producers     │    │    Kafka     │    │   Consumers     │
│                 │    │  Brokers     │    │                 │
│ • User Service  │───▶│              │───▶│ • All Services  │
│ • Product Svc   │    │ Topics:      │    │                 │
│ • Order Service │    │   user.*     │    │ Event Handlers  │
│ • Payment Svc   │    │   product.*  │    │ Dead Letter Q   │
│ • Inventory Svc │    │   order.*    │    │ Retry Logic     │
│ • Shipping Svc  │    │   payment.*  │    │                 │
│ • Review Svc    │    │   inventory.*│    │                 │
│ • Notification  │    │   shipping.* │    │                 │
│                 │    │   review.*   │    │                 │
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  Schema       │
                       │  Registry     │
                       │  (Avro)       │
                       └──────────────┘
```

### Kafka Configuration

**Cluster Setup:**
- **Brokers:** 3+ nodes for high availability
- **Partitions:** 12-24 per topic for parallelism
- **Replication Factor:** 3 for durability
- **Retention:** 7 days for operational topics, 90 days for audit topics

**Topic Naming Convention:**
```
{domain}.{entity}.{action}
Examples:
- user.created
- product.updated
- order.placed
- payment.succeeded
- inventory.reserved
- shipping.label_created
- review.approved
```

**Topic Categories:**

| Category | Topics | Retention | Partitions |
|----------|--------|-----------|------------|
| **User Events** | `user.*` | 90 days | 12 |
| **Product Events** | `product.*` | 30 days | 24 |
| **Order Events** | `order.*` | 365 days | 24 |
| **Payment Events** | `payment.*` | 365 days | 12 |
| **Inventory Events** | `inventory.*` | 30 days | 12 |
| **Shipping Events** | `shipping.*` | 90 days | 12 |
| **Review Events** | `review.*` | 30 days | 12 |
| **Notification Events** | `notification.*` | 7 days | 6 |

---

## Event Schema Design

### Event Envelope (CloudEvents Specification)

All events follow the CloudEvents 1.0 specification:

```json
{
  "specversion": "1.0",
  "type": "com.ecommerce.order.placed",
  "source": "/order-service",
  "id": "event-uuid-12345678",
  "time": "2026-02-16T10:30:00.000Z",
  "correlation_id": "req-12345678-abcd-efgh",
  "data": {
    // Event-specific payload
  }
}
```

**Header Fields:**
- `specversion`: "1.0"
- `type`: Event type (e.g., "com.ecommerce.user.created")
- `source`: Service that produced the event
- `id`: Unique event ID (UUID v7)
- `time`: Event timestamp (ISO 8601)
- `correlation_id`: Links related events from same request

### Event Categories

#### 1. Entity Lifecycle Events

**Pattern:** `{entity}.created`, `{entity}.updated`, `{entity}.deleted`

**Purpose:** Notify other services of entity changes

**Examples:**

**User Created Event:**
```json
{
  "specversion": "1.0",
  "type": "com.ecommerce.user.created",
  "source": "/user-service",
  "id": "evt-user-123",
  "time": "2026-02-16T10:00:00.000Z",
  "correlation_id": "req-abc-123",
  "data": {
    "user_id": "user-uuid-123",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "roles": ["customer"],
    "created_at": "2026-02-16T10:00:00.000Z"
  }
}
```

**Product Updated Event:**
```json
{
  "specversion": "1.0",
  "type": "com.ecommerce.product.updated",
  "source": "/product-service",
  "id": "evt-prod-456",
  "time": "2026-02-16T11:00:00.000Z",
  "correlation_id": "req-def-456",
  "data": {
    "product_id": "prod-uuid-456",
    "sku": "APPLE-IPHONE-14",
    "name": "iPhone 14 Pro",
    "changes": {
      "pricing": {
        "old": {"base_price": 999.00},
        "new": {"base_price": 899.00, "sale_price": 799.00}
      }
    },
    "updated_at": "2026-02-16T11:00:00.000Z",
    "updated_by": "admin-uuid-789"
  }
}
```

#### 2. Business Process Events

**Pattern:** `{process}.{action}`

**Purpose:** Drive complex workflows and sagas

**Examples:**

**Order Placed Event:**
```json
{
  "specversion": "1.0",
  "type": "com.ecommerce.order.placed",
  "source": "/order-service",
  "id": "evt-order-789",
  "time": "2026-02-16T12:00:00.000Z",
  "correlation_id": "req-ghi-789",
  "data": {
    "order_id": "order-uuid-789",
    "order_number": "ORD-20260216-A1B2C3",
    "user_id": "user-uuid-123",
    "currency": "USD",
    "total_amount": 1108.89,
    "items": [
      {
        "product_id": "prod-uuid-456",
        "variant_sku": "IPHONE14-BLACK-128",
        "product_name": "iPhone 14 Pro",
        "unit_price": 999.00,
        "quantity": 1,
        "line_total": 999.00
      }
    ],
    "shipping_address": {
      "full_name": "John Doe",
      "line1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country_code": "US"
    },
    "placed_at": "2026-02-16T12:00:00.000Z"
  }
}
```

**Payment Succeeded Event:**
```json
{
  "specversion": "1.0",
  "type": "com.ecommerce.payment.succeeded",
  "source": "/payment-service",
  "id": "evt-payment-101",
  "time": "2026-02-16T12:01:00.000Z",
  "correlation_id": "req-ghi-789",
  "data": {
    "payment_id": "payment-uuid-101",
    "order_id": "order-uuid-789",
    "user_id": "user-uuid-123",
    "amount": 1108.89,
    "currency": "USD",
    "payment_method": "card",
    "provider": "stripe",
    "provider_payment_id": "pi_1234567890",
    "paid_at": "2026-02-16T12:01:00.000Z"
  }
}
```

**Inventory Reserved Event:**
```json
{
  "specversion": "1.0",
  "type": "com.ecommerce.inventory.reserved",
  "source": "/inventory-service",
  "id": "evt-inv-202",
  "time": "2026-02-16T12:02:00.000Z",
  "correlation_id": "req-ghi-789",
  "data": {
    "reservation_id": "res-uuid-202",
    "order_id": "order-uuid-789",
    "items": [
      {
        "product_id": "prod-uuid-456",
        "variant_sku": "IPHONE14-BLACK-128",
        "warehouse_code": "WH-01",
        "quantity": 1,
        "reserved_at": "2026-02-16T12:02:00.000Z",
        "expires_at": "2026-02-16T12:17:00.000Z"
      }
    ]
  }
}
```

#### 3. System Events

**Pattern:** `{component}.{action}`

**Purpose:** Infrastructure and monitoring events

**Examples:**

**Service Health Event:**
```json
{
  "specversion": "1.0",
  "type": "com.ecommerce.service.health_changed",
  "source": "/order-service",
  "id": "evt-health-303",
  "time": "2026-02-16T13:00:00.000Z",
  "data": {
    "service": "order-service",
    "instance": "order-service-7f5b8c9d",
    "status": "unhealthy",
    "checks": {
      "database": "down",
      "kafka": "up",
      "redis": "up"
    },
    "timestamp": "2026-02-16T13:00:00.000Z"
  }
}
```

---

## Asynchronous Processing Patterns

### 1. Event Sourcing Pattern

**Used in:** Order Service, Payment Service

**Purpose:** Complete audit trail and state reconstruction

**Implementation:**

```typescript
// Order Aggregate (Event Sourced)
class OrderAggregate {
  private events: OrderEvent[] = [];
  private state: OrderState;

  constructor(events: OrderEvent[]) {
    this.events = events;
    this.state = this.replayEvents(events);
  }

  placeOrder(command: PlaceOrderCommand): OrderPlacedEvent {
    // Validate command against current state
    if (this.state.status !== 'pending') {
      throw new Error('Order already placed');
    }

    const event = new OrderPlacedEvent({
      orderId: this.state.id,
      // ... event data
    });

    this.events.push(event);
    this.state = this.applyEvent(event);

    return event;
  }

  private replayEvents(events: OrderEvent[]): OrderState {
    let state = new OrderState();
    for (const event of events) {
      state = this.applyEvent(event, state);
    }
    return state;
  }

  private applyEvent(event: OrderEvent, state = this.state): OrderState {
    switch (event.type) {
      case 'OrderPlaced':
        return {
          ...state,
          status: 'placed',
          placedAt: event.timestamp
        };
      // ... other event handlers
    }
  }
}
```

**Event Store Schema (PostgreSQL):**
```sql
CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL, -- order_id
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  event_version INTEGER NOT NULL,
  correlation_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_events_aggregate ON order_events (aggregate_id, event_version);
```

### 2. CQRS Pattern

**Used in:** Product Service

**Purpose:** Optimize read and write patterns

**Implementation:**

**Write Model (MongoDB):**
```javascript
// Product Command Handler
class ProductCommandHandler {
  async updateProduct(command: UpdateProductCommand) {
    const product = await this.productRepository.findById(command.productId);

    // Apply business logic
    product.updatePricing(command.pricing);

    // Save to MongoDB
    await this.productRepository.save(product);

    // Publish event
    await this.eventPublisher.publish('product.updated', {
      product_id: product.id,
      changes: command.changes
    });

    // Update read model asynchronously
    await this.readModelUpdater.updateProduct(product);
  }
}
```

**Read Model (Elasticsearch):**
```javascript
// Product Read Model Updater
class ProductReadModelUpdater {
  async updateProduct(product) {
    const document = {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      pricing: product.pricing,
      tags: product.tags,
      avg_rating: product.avgRating,
      review_count: product.reviewCount,
      status: product.status,
      updated_at: product.updatedAt
    };

    await this.elasticsearch.index({
      index: 'products',
      id: product.id,
      body: document
    });
  }
}
```

### 3. Saga Pattern

**Used for:** Distributed transactions across services

**Implementation:**

**Order Placement Saga:**
```typescript
class OrderPlacementSaga {
  private steps: SagaStep[] = [
    {
      action: 'ReserveInventory',
      compensate: 'ReleaseInventory',
      status: 'pending'
    },
    {
      action: 'AuthorizePayment',
      compensate: 'CancelPayment',
      status: 'pending'
    },
    {
      action: 'ConfirmOrder',
      compensate: 'CancelOrder',
      status: 'pending'
    }
  ];

  async execute(orderId: string) {
    try {
      // Step 1: Reserve Inventory
      await this.inventoryService.reserveForOrder(orderId);
      this.steps[0].status = 'completed';

      // Step 2: Authorize Payment
      await this.paymentService.authorize(orderId);
      this.steps[1].status = 'completed';

      // Step 3: Confirm Order
      await this.orderService.confirm(orderId);
      this.steps[2].status = 'completed';

    } catch (error) {
      // Compensate completed steps in reverse order
      await this.compensate();
      throw error;
    }
  }

  private async compensate() {
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const step = this.steps[i];
      if (step.status === 'completed') {
        await this[step.compensate.toLowerCase()]();
        step.status = 'compensated';
      }
    }
  }
}
```

### 4. Outbox Pattern

**Used for:** Reliable event publishing

**Implementation:**

```sql
-- Outbox table
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  event_data JSONB NOT NULL,
  correlation_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Publish events in same transaction as business logic
BEGIN;
  -- Update order status
  UPDATE orders SET status = 'placed' WHERE id = $1;

  -- Insert event to outbox
  INSERT INTO outbox_events (aggregate_id, event_type, event_data)
  VALUES ($1, 'OrderPlaced', $event_data);
COMMIT;
```

**Outbox Processor:**
```typescript
class OutboxProcessor {
  async processPendingEvents() {
    const pendingEvents = await this.outboxRepository.findPending();

    for (const event of pendingEvents) {
      try {
        await this.kafkaPublisher.publish(event.event_type, event.event_data);
        await this.outboxRepository.markPublished(event.id);
      } catch (error) {
        await this.handlePublishError(event, error);
      }
    }
  }
}
```

### 5. Event Replay & Projections

**Used for:** Building read models and analytics

**Implementation:**

```typescript
class OrderProjection {
  private projection = new Map<string, OrderSummary>();

  async handleEvent(event: OrderEvent) {
    const orderId = event.data.order_id;

    switch (event.type) {
      case 'OrderPlaced':
        this.projection.set(orderId, {
          id: orderId,
          total: event.data.total_amount,
          status: 'placed',
          placedAt: event.time
        });
        break;

      case 'OrderShipped':
        const order = this.projection.get(orderId);
        if (order) {
          order.status = 'shipped';
        }
        break;
    }
  }

  getOrderSummary(orderId: string): OrderSummary | undefined {
    return this.projection.get(orderId);
  }

  getAllSummaries(): OrderSummary[] {
    return Array.from(this.projection.values());
  }
}
```

---

## Consumer Patterns

### 1. Event-Driven Consumers

**Pattern:** Listen for specific events and react

```typescript
class PaymentEventConsumer {
  @EventHandler('payment.succeeded')
  async handlePaymentSucceeded(event: PaymentSucceededEvent) {
    // Update order status
    await this.orderService.markAsPaid(event.data.order_id);

    // Send confirmation notification
    await this.notificationService.sendOrderConfirmation(event.data.order_id);

    // Trigger shipping process
    await this.shippingService.createShipment(event.data.order_id);
  }
}
```

### 2. Dead Letter Queue (DLQ)

**Purpose:** Handle failed event processing

```typescript
class EventConsumer {
  async processEvent(event: CloudEvent) {
    try {
      await this.processBusinessLogic(event);
      await this.acknowledgeEvent(event);
    } catch (error) {
      await this.handleProcessingError(event, error);
    }
  }

  private async handleProcessingError(event: CloudEvent, error: Error) {
    const retryCount = await this.getRetryCount(event);

    if (retryCount < 3) {
      // Retry with exponential backoff
      await this.scheduleRetry(event, retryCount + 1);
    } else {
      // Send to DLQ
      await this.sendToDLQ(event, error);
    }
  }
}
```

### 3. Idempotent Consumers

**Pattern:** Ensure events are processed exactly once

```typescript
class IdempotentConsumer {
  private processedEvents = new Set<string>();

  async processEvent(event: CloudEvent) {
    const eventKey = `${event.type}:${event.id}`;

    if (this.processedEvents.has(eventKey)) {
      return; // Already processed
    }

    try {
      await this.businessLogic(event);
      this.processedEvents.add(eventKey);

      // Persist processed event IDs for recovery
      await this.persistenceStore.saveProcessedEvent(eventKey);
    } catch (error) {
      // Handle error
    }
  }

  async initialize() {
    // Load previously processed events on startup
    this.processedEvents = await this.persistenceStore.loadProcessedEvents();
  }
}
```

---

## Event Streaming Infrastructure

### Schema Registry

**Purpose:** Ensure event schema evolution and compatibility

```typescript
// Event Schema Definition (Avro)
const OrderPlacedSchema = {
  type: 'record',
  name: 'OrderPlaced',
  fields: [
    { name: 'order_id', type: 'string' },
    { name: 'user_id', type: 'string' },
    { name: 'total_amount', type: 'double' },
    { name: 'currency', type: 'string' },
    { name: 'items', type: { type: 'array', items: 'OrderItem' } }
  ]
};
```

### Monitoring & Observability

**Metrics to Track:**
- Event publish rate per topic
- Consumer lag per partition
- Processing latency per event type
- Error rate per consumer
- DLQ message count

**Logging:**
```json
{
  "timestamp": "2026-02-16T10:30:00.000Z",
  "level": "INFO",
  "service": "order-service",
  "event_type": "order.placed",
  "event_id": "evt-123",
  "correlation_id": "req-456",
  "processing_time_ms": 45,
  "status": "success"
}
```

### Testing

**Event Contract Testing:**
```typescript
describe('OrderPlaced Event', () => {
  it('should contain required fields', () => {
    const event = createOrderPlacedEvent(orderData);

    expect(event.specversion).toBe('1.0');
    expect(event.type).toBe('com.ecommerce.order.placed');
    expect(event.data.order_id).toBeDefined();
    expect(event.data.total_amount).toBeGreaterThan(0);
  });

  it('should be consumed correctly', async () => {
    const event = createOrderPlacedEvent(orderData);

    await eventPublisher.publish('order.placed', event);

    // Wait for consumer to process
    await waitForConsumer();

    // Verify side effects
    const order = await orderRepository.findById(event.data.order_id);
    expect(order.status).toBe('processing');
  });
});
```

---

This event-driven architecture provides loose coupling between services, enables complex workflows, and supports scalable, resilient asynchronous processing patterns across the e-commerce platform.