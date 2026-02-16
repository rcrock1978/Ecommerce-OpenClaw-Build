# 03 — Microservices Design

## Overview

This document defines the service boundaries, responsibilities, and communication patterns for the e-commerce microservice platform. Each service operates within a clear bounded context, maintaining loose coupling through event-driven architecture and API contracts.

---

## Service Boundaries & Responsibilities

### 1. User Service (Identity & Access Management)

**Bounded Context:** User lifecycle, authentication, authorization, and profile management.

**Responsibilities:**
- User registration, login, logout, password reset
- JWT token generation and validation
- Role-based access control (RBAC) with granular permissions
- User profile management (addresses, preferences, avatar)
- Session management and refresh tokens
- User verification (email/phone) and account status

**Data Ownership:** Users, roles, user_roles, addresses, refresh_tokens (PostgreSQL)

**Business Rules:**
- Email uniqueness across all users
- Soft deletes for GDPR compliance
- Password complexity and rate limiting
- Automatic token expiration and revocation

### 2. Product Service (Catalog & Discovery)

**Bounded Context:** Product catalog, categorization, and search functionality.

**Responsibilities:**
- Product CRUD operations (create, read, update, archive)
- Category hierarchy management (nested categories with materialized paths)
- Product variants and attributes (color, size, material)
- Pricing management (base price, sale pricing, currency)
- Product images and SEO metadata
- Full-text search and faceted filtering
- Product availability status and seller association

**Data Ownership:** Products, categories (MongoDB)

**Business Rules:**
- SKU uniqueness across all products/variants
- Category tree depth limit (max 5 levels)
- Automatic slug generation from product name
- Sale price validation (must be < base price)
- Denormalized review aggregations (avg_rating, review_count)

### 3. Cart Service (Shopping Experience)

**Bounded Context:** Shopping cart functionality for anonymous and authenticated users.

**Responsibilities:**
- Cart item management (add, update, remove, clear)
- Cart persistence across sessions (anonymous → authenticated merge)
- Cart expiration and cleanup (TTL-based)
- Cart locking during checkout to prevent race conditions
- Coupon code application and discount calculation
- Cart item availability validation against inventory
- Cart snapshot for order creation

**Data Ownership:** Cart hashes and metadata (Redis)

**Business Rules:**
- Anonymous carts expire after 24 hours
- Authenticated carts expire after 7 days of inactivity
- Maximum 100 items per cart
- Quantity validation against available inventory
- Cart locks expire after 5 minutes to prevent deadlocks

### 4. Order Service (Order Management)

**Bounded Context:** Order lifecycle from creation to fulfillment.

**Responsibilities:**
- Order creation from cart snapshot
- Order status management (pending → confirmed → processing → shipped → delivered)
- Order history and status change tracking
- Order totals calculation (subtotal, tax, shipping, discounts)
- Idempotent order creation (duplicate prevention)
- Order cancellation and refund coordination
- Order search and filtering for users and admins

**Data Ownership:** Orders, order_items, order_status_history (PostgreSQL)

**Business Rules:**
- Order numbers are human-readable and unique
- Idempotency keys prevent duplicate orders
- Soft deletes for audit trail preservation
- Status transitions are validated (no skipping states)
- Order totals are immutable once placed

### 5. Payment Service (Payment Processing)

**Bounded Context:** Financial transactions and payment gateway integration.

**Responsibilities:**
- Payment authorization and capture
- Multiple payment methods (credit card, PayPal, bank transfer)
- PCI DSS compliance and secure credential handling
- Payment status tracking and reconciliation
- Refund processing (full and partial)
- Idempotent payment operations
- Fraud detection integration
- Payment provider webhook handling

**Data Ownership:** Payments, refunds (PostgreSQL)

**Business Rules:**
- All amounts stored with 2 decimal precision
- Idempotency keys for all payment operations
- No payment reversals without refund record
- Automatic payment failure retry (configurable)
- Currency validation against order currency

### 6. Inventory Service (Stock Management)

**Bounded Context:** Product inventory and stock allocation.

**Responsibilities:**
- Stock level tracking (total, reserved, available)
- Inventory reservation for pending orders
- Low stock alerts and automatic reorder triggers
- Multi-warehouse support with warehouse-specific stock
- Inventory adjustments (manual and automated)
- Product variant inventory management
- Inventory audit trail and reporting

**Data Ownership:** Inventory, reservations (PostgreSQL)

**Business Rules:**
- Reservations expire automatically (15 minutes)
- Available quantity = total - reserved
- No overselling (reservation validation)
- Warehouse codes are unique and predefined
- Reorder triggers when below reorder_point

### 7. Notification Service (Communication)

**Bounded Context:** All outbound communication with customers and internal stakeholders.

**Responsibilities:**
- Email notifications (order confirmations, shipping updates, password reset)
- SMS notifications for critical events (delivery, payment issues)
- Push notifications for mobile app users
- Notification templates and personalization
- Delivery tracking and retry logic
- Bounce and unsubscribe handling
- Notification preferences per user

**Data Ownership:** Notification templates, delivery tracking (PostgreSQL)

**Business Rules:**
- Notifications are queued asynchronously
- Delivery status tracked (sent, delivered, bounced)
- User preferences override default communication
- Rate limiting per notification type
- Templates support multiple languages/locales

### 8. Review Service (Product Reviews)

**Bounded Context:** Customer reviews, ratings, and seller responses.

**Responsibilities:**
- Review creation and moderation
- Rating aggregation and display
- Verified purchase validation
- Review helpfulness voting
- Seller reply functionality
- Review reporting and content moderation
- Review search and filtering

**Data Ownership:** Reviews (MongoDB)

**Business Rules:**
- One review per product per user
- Verified purchase required for certain features
- Reviews require moderation before public display
- Rating range: 1-5 stars
- Helpful votes prevent spam/abuse

### 9. Shipping Service (Fulfillment & Logistics)

**Bounded Context:** Order fulfillment and shipping logistics.

**Responsibilities:**
- Shipping rate calculation and carrier selection
- Shipping label generation and tracking
- Multi-carrier integration (UPS, FedEx, DHL, USPS)
- Shipment status updates and tracking events
- International shipping support
- Return shipping coordination
- Shipping cost optimization

**Data Ownership:** Shipments, tracking_events (PostgreSQL)

**Business Rules:**
- Tracking numbers are unique per carrier
- Estimated delivery dates calculated from carrier APIs
- Shipment status updates trigger order status changes
- Dimensional weight calculations for accurate pricing
- Warehouse address validation

### 10. API Gateway (Edge Services)

**Bounded Context:** Request routing, authentication, and cross-cutting concerns.

**Responsibilities:**
- Request routing to appropriate services
- JWT token validation and user context propagation
- Rate limiting and request throttling
- Request/response transformation
- CORS handling and security headers
- API versioning and deprecation management
- Request logging and metrics collection

**Data Ownership:** Kong configuration and plugins

**Business Rules:**
- All external requests go through the gateway
- Internal service-to-service calls bypass gateway
- Rate limits configurable per endpoint/user/role
- Request correlation IDs propagated throughout call chain

---

## Communication Patterns

### Synchronous Communication (REST/gRPC)

Used for immediate responses and user-facing operations.

| From Service | To Service | Purpose | Pattern |
|-------------|------------|---------|---------|
| API Gateway | All Services | Route requests | REST |
| Frontend | User Service | Authentication | REST |
| Frontend | Product Service | Product browsing | REST |
| Frontend | Cart Service | Cart operations | REST |
| Frontend | Order Service | Order history | REST |
| Order Service | User Service | User details | REST |
| Order Service | Product Service | Product details | REST |
| Order Service | Payment Service | Payment initiation | REST |
| Order Service | Inventory Service | Stock reservation | REST |
| Order Service | Shipping Service | Shipping calculation | REST |
| Payment Service | External | Payment gateway | REST |
| Shipping Service | External | Carrier APIs | REST |

**Resilience Patterns:**
- Circuit breaker with exponential backoff
- Timeout: 3s default, 10s for payment operations
- Retry: Up to 3 attempts for idempotent operations
- Fallback: Cached responses or degraded functionality

### Asynchronous Communication (Kafka Events)

Used for decoupling services and eventual consistency workflows.

#### Core Event Topics

| Topic | Producer | Consumers | Purpose |
|-------|----------|-----------|---------|
| `user.*` | User Service | All services | User lifecycle events |
| `product.*` | Product Service | Cart, Order, Inventory, Review | Product changes |
| `cart.*` | Cart Service | - | Cart events (future use) |
| `order.*` | Order Service | Payment, Inventory, Shipping, Notification | Order lifecycle |
| `payment.*` | Payment Service | Order, Notification | Payment status |
| `inventory.*` | Inventory Service | Order, Product | Stock changes |
| `notification.*` | Notification Service | - | Notification delivery |
| `review.*` | Review Service | Product | Review aggregations |
| `shipping.*` | Shipping Service | Order, Notification | Shipment updates |

#### Key Event Flows

**Order Placement Saga:**
```
OrderCreated (Order) → InventoryReserved (Inventory) → PaymentAuthorized (Payment) → OrderConfirmed (Order)
    ↓
ShippingLabelCreated (Shipping) → NotificationSent (Notification)
```

**Payment Processing:**
```
PaymentInitiated (Order) → PaymentAuthorized (Payment) → OrderPlaced (Order)
    ↓
InventoryConfirmed (Inventory) → ShippingInitiated (Shipping)
```

**Product Updates:**
```
ProductCreated (Product) → InventoryInitialized (Inventory) → SearchIndexed (Product)
```

**Patterns Used:**
- **Event Sourcing:** Order and Payment services
- **CQRS:** Product service (write to MongoDB, read from Elasticsearch)
- **Saga:** Distributed transactions across services
- **Outbox Pattern:** Reliable event publishing
- **Dead Letter Queue:** Failed message handling

### Service Mesh Integration

While starting without Istio, future service mesh adoption will provide:

- **mTLS:** Zero-trust security between services
- **Traffic Management:** Canary deployments, traffic splitting
- **Observability:** Automatic tracing and metrics
- **Resilience:** Circuit breaking at mesh level

---

## Data Consistency & Transactions

### Eventual Consistency

Cross-service operations use eventual consistency:

- **Order Creation:** Cart snapshot → Order created → Events trigger downstream updates
- **Payment Confirmation:** Payment succeeds → Order status updated → Inventory committed
- **Inventory Reservation:** Order placed → Inventory reserved → Shipping initiated

### Distributed Sagas

Critical workflows use saga pattern for rollback:

```yaml
# Order Placement Saga
steps:
  - action: ReserveInventory
    compensate: ReleaseInventory
  - action: AuthorizePayment
    compensate: CancelPayment
  - action: ConfirmOrder
    compensate: CancelOrder
```

### Idempotency

All external operations support idempotency keys:

- Order creation (prevents duplicate orders)
- Payment processing (handles webhook retries)
- Inventory adjustments (bulk operations)

---

## Service Interface Contracts

### REST API Standards

All services follow REST conventions:

- **Resource Naming:** `/api/v1/users`, `/api/v1/products/{id}`
- **HTTP Methods:** GET, POST, PUT, PATCH, DELETE
- **Status Codes:** 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error
- **Content-Type:** `application/json`
- **Pagination:** Cursor-based for large datasets
- **Filtering/Sorting:** Query parameters (`?status=active&sort=-created_at`)

### Event Schema Standards

Events follow CloudEvents specification:

```json
{
  "specversion": "1.0",
  "type": "com.ecommerce.order.placed",
  "source": "/order-service",
  "id": "uuid",
  "time": "2026-02-16T12:00:00Z",
  "correlation_id": "req-123",
  "data": {
    "order_id": "uuid",
    "user_id": "uuid",
    "total_amount": 99.99
  }
}
```

### Error Handling

Standardized error responses:

```json
{
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "Product XYZ is out of stock",
    "details": {
      "product_id": "uuid",
      "available_quantity": 0,
      "requested_quantity": 5
    },
    "correlation_id": "req-123"
  }
}
```

---

## Deployment & Scaling Considerations

### Independent Scaling

Each service scales independently based on load:

- **User Service:** Scales with authentication load
- **Product Service:** Scales with catalog browsing
- **Cart Service:** Redis-backed, scales horizontally
- **Order Service:** Scales with transaction volume
- **Payment Service:** High availability, PCI compliance
- **Inventory Service:** Scales with product catalog size

### Database Scaling

- **PostgreSQL:** Read replicas, Citus for horizontal scaling
- **MongoDB:** Replica sets with sharding
- **Redis:** Cluster mode for high availability
- **Kafka:** Multiple brokers, partitioned topics

### Resource Allocation

| Service | CPU | Memory | Storage | Scaling Strategy |
|---------|-----|--------|---------|------------------|
| User | Medium | Medium | High (users) | Horizontal pods |
| Product | High | High | Very High (catalog) | Horizontal pods + read replicas |
| Cart | Low | Low | Low (Redis) | Redis cluster |
| Order | High | Medium | High (orders) | Horizontal pods |
| Payment | Medium | Medium | Medium | Horizontal pods + PCI isolation |
| Inventory | Medium | Medium | Medium | Horizontal pods |
| Notification | Medium | Medium | Medium | Queue-based scaling |
| Review | Medium | Medium | High (reviews) | Horizontal pods |
| Shipping | Medium | Medium | Medium | Horizontal pods |

---

This design ensures each service has clear boundaries, well-defined responsibilities, and efficient communication patterns that support the e-commerce platform's scalability and maintainability requirements.