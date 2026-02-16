# 01 — Architecture Overview

## High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER                                     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Next.js Web │  │  Mobile App  │  │  Admin Panel │  │  3rd Party   │    │
│  │  (SSR/SSG)   │  │  (React Nat.)│  │  (Next.js)   │  │  Integrations│    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         └──────────────────┴────────────────┴──────────────────┘            │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────▼────────────────────────────────────────────┐
│                          EDGE / GATEWAY TIER                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                        CDN (CloudFront / Cloudflare)                 │    │
│  └──────────────────────────────┬───────────────────────────────────────┘    │
│                                 │                                            │
│  ┌──────────────────────────────▼───────────────────────────────────────┐    │
│  │                     Kong API Gateway (HA Cluster)                    │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │Rate Limit│ │JWT Auth  │ │Logging   │ │CORS      │ │Circuit   │  │    │
│  │  │Plugin    │ │Plugin    │ │Plugin    │ │Plugin    │ │Breaker   │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │    │
│  └──────────────────────────────┬───────────────────────────────────────┘    │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────────┐
│                          SERVICE TIER (Kubernetes)                            │
│                                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │  User    │ │ Product  │ │  Cart    │ │  Order   │ │ Payment  │         │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │ │ Service  │         │
│  │ (TS/Node)│ │ (TS/Node)│ │ (TS/Node)│ │   (Go)   │ │   (Go)   │         │
│  │ :3001    │ │ :3002    │ │ :3003    │ │ :3004    │ │ :3005    │         │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘         │
│       │             │            │             │            │                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │Inventory │ │Notific.  │ │ Review   │ │ Shipping │                       │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │                       │
│  │ (TS/Node)│ │ (TS/Node)│ │ (TS/Node)│ │ (TS/Node)│                       │
│  │ :3006    │ │ :3007    │ │ :3008    │ │ :3009    │                       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘                       │
└───────┼─────────────┼────────────┼─────────────┼────────────────────────────┘
        │             │            │             │
┌───────▼─────────────▼────────────▼─────────────▼────────────────────────────┐
│                          DATA / MESSAGING TIER                               │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  PostgreSQL  │ │   MongoDB    │ │    Redis     │ │Elasticsearch │       │
│  │  (Primary)   │ │  (Catalog)   │ │  (Cache/Cart)│ │  (Search)    │       │
│  │  Users,Orders│ │  Products,   │ │  Sessions    │ │  Products    │       │
│  │  Inventory,  │ │  Reviews     │ │              │ │              │       │
│  │  Payments    │ │              │ │              │ │              │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                    Apache Kafka (Event Bus)                          │    │
│  │  Topics: user.*, product.*, order.*, payment.*, inventory.*,        │    │
│  │          notification.*, shipping.*, review.*                        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐                                          │
│  │  MinIO / S3  │ │   Jaeger     │                                          │
│  │  (Objects)   │ │  (Tracing)   │                                          │
│  └──────────────┘ └──────────────┘                                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                       OBSERVABILITY TIER                                     │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Prometheus   │ │   Grafana    │ │ ELK Stack    │ │  PagerDuty   │       │
│  │  (Metrics)   │ │ (Dashboards) │ │  (Logging)   │ │  (Alerting)  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Domain-Driven Design (DDD)

Each microservice owns a **bounded context** — a clear boundary around a business domain. Services never share databases.

```
┌─────────────────────────────────────────────────────────┐
│                    Bounded Contexts                      │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Identity &  │  │  Catalog &  │  │  Shopping   │    │
│  │  Access      │  │  Discovery  │  │  Experience │    │
│  │             │  │             │  │             │    │
│  │  User Svc   │  │ Product Svc │  │  Cart Svc   │    │
│  │             │  │ Review Svc  │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Order      │  │  Fulfillment│  │ Communication│   │
│  │  Management │  │             │  │             │    │
│  │             │  │ Inventory   │  │Notification │    │
│  │  Order Svc  │  │ Shipping Svc│  │  Service    │    │
│  │  Payment Svc│  │             │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Key DDD Patterns Used:**

- **Aggregates** — Order is an aggregate root containing OrderItems. All mutations go through the root.
- **Value Objects** — Money (amount + currency), Address, Email are immutable value objects.
- **Domain Events** — `OrderPlaced`, `PaymentProcessed`, `InventoryReserved` drive cross-service workflows.
- **Anti-Corruption Layer** — External payment providers (Stripe, PayPal) are wrapped behind a clean domain interface.
- **Ubiquitous Language** — Each bounded context defines its own vocabulary. A "Product" in Catalog differs from a "LineItem" in Orders.

### 2. CQRS (Command Query Responsibility Segregation)

Applied selectively where read and write patterns diverge significantly:

```
                    ┌─────────────────┐
                    │   API Gateway   │
                    └────┬───────┬────┘
                         │       │
                    Write│       │Read
                         ▼       ▼
                    ┌────────┐ ┌────────────┐
                    │Command │ │  Query     │
                    │ Handler│ │  Handler   │
                    └───┬────┘ └─────┬──────┘
                        │            │
                        ▼            ▼
                    ┌────────┐ ┌────────────┐
                    │PostgreSQL│ │Elasticsearch│
                    │(Write DB)│ │ (Read Model)│
                    └───┬────┘ └────────────┘
                        │            ▲
                        │   Event    │
                        └────────────┘
                        (Kafka sync)
```

**Where CQRS is applied:**
- **Product Service** — Writes go to MongoDB; reads are served by Elasticsearch for full-text search, faceting, and autocomplete.
- **Order Service** — Command side uses PostgreSQL with strict consistency; query side uses denormalized read models for dashboard/reporting.

**Where CQRS is NOT applied** (simplicity wins):
- User Service — CRUD is sufficient.
- Cart Service — Redis handles both reads and writes naturally.

### 3. Event Sourcing (Selective)

Event sourcing is used in the **Order Service** and **Payment Service** where a complete audit trail is business-critical.

```
Order Aggregate Event Stream:
─────────────────────────────────────────────────────────
│ OrderCreated │ ItemAdded │ ItemAdded │ OrderPlaced │ PaymentAuthorized │ OrderFulfilled │
─────────────────────────────────────────────────────────
     t=0          t=1         t=2          t=3              t=4                t=5

Current State = replay(events[0..n])
```

**Why selective, not universal:**
- Event sourcing adds complexity (snapshots, projections, schema evolution).
- Only use it where the audit trail and temporal queries provide clear business value.
- Cart and Product services use standard state-based persistence — simpler and sufficient.

### 4. Database-per-Service

Every service owns its data. No shared databases. Period.

| Service | Database | Rationale |
|---|---|---|
| User | PostgreSQL | Relational data, ACID transactions, strong consistency |
| Product | MongoDB | Flexible schema for varied product attributes |
| Cart | Redis | In-memory speed, TTL expiry, atomic operations |
| Order | PostgreSQL | Complex relations, event sourcing table, ACID |
| Payment | PostgreSQL | Financial data requires ACID, audit trail |
| Inventory | PostgreSQL | Stock counts need strong consistency |
| Notification | PostgreSQL | Template storage, delivery tracking |
| Review | MongoDB | Flexible content, nested replies |
| Shipping | PostgreSQL | Tracking events, carrier integrations |

### 5. Communication Patterns

```
┌─────────────────────────────────────────────────┐
│           Synchronous (REST / gRPC)             │
│                                                 │
│  Used for: Queries, user-facing reads,          │
│  operations needing immediate response          │
│                                                 │
│  Examples:                                      │
│  • GET /products/:id                            │
│  • POST /auth/login                             │
│  • GET /orders/:id                              │
│                                                 │
│  Patterns: Circuit breaker, retry w/ backoff,   │
│  timeout, fallback                              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│          Asynchronous (Kafka Events)            │
│                                                 │
│  Used for: State changes, cross-service         │
│  workflows, eventual consistency                │
│                                                 │
│  Examples:                                      │
│  • OrderPlaced → triggers inventory reservation │
│  • PaymentProcessed → triggers notification     │
│  • InventoryReserved → triggers shipping        │
│                                                 │
│  Patterns: Saga, outbox, dead letter queue,     │
│  idempotent consumers                           │
└─────────────────────────────────────────────────┘
```

**Decision rule:** If the caller needs a response → REST. If it's "fire and react" → Kafka.

### 6. Resilience Patterns

| Pattern | Implementation | Where |
|---|---|---|
| **Circuit Breaker** | opossum (Node), gobreaker (Go) | All inter-service REST calls |
| **Retry with Backoff** | Exponential backoff + jitter | Kafka consumers, HTTP clients |
| **Timeout** | 3s default, 10s for payment | All outbound calls |
| **Bulkhead** | Separate thread pools per dependency | Order Service (payment vs inventory calls) |
| **Fallback** | Cached/default responses | Product search → return cached results |
| **Idempotency** | Idempotency keys in headers | Payment, Order creation |
| **Outbox Pattern** | Transactional outbox table | Order, Payment (Kafka publish reliability) |

### 7. Service Mesh Considerations

For production at scale, an Istio service mesh provides:

```
┌──────────────────────────────────────────────────┐
│                 Istio Service Mesh               │
│                                                  │
│  ┌────────┐    Envoy    ┌────────┐              │
│  │Service │◄──Sidecar──►│Service │              │
│  │   A    │   Proxy     │   B    │              │
│  └────────┘             └────────┘              │
│                                                  │
│  Features:                                       │
│  • mTLS between all services (zero-trust)       │
│  • Traffic splitting (canary releases)          │
│  • Automatic retries & circuit breaking         │
│  • Distributed tracing (Jaeger integration)     │
│  • Traffic mirroring for testing                │
│  • Rate limiting at mesh level                  │
└──────────────────────────────────────────────────┘
```

**Our stance:** Start without Istio. Use application-level resilience (circuit breakers, retries). Adopt Istio when operating >20 services or when mTLS becomes a compliance requirement. Premature mesh adoption adds operational complexity that small teams can't afford.

---

## Cross-Cutting Concerns

| Concern | Solution |
|---|---|
| **Correlation IDs** | Every request gets a `X-Correlation-ID` header, propagated through all services and Kafka events |
| **Structured Logging** | JSON logs with Winston (Node) / Zap (Go), shipped to ELK |
| **Health Checks** | `/health/live` (liveness) and `/health/ready` (readiness) on every service |
| **Configuration** | Environment variables → Kubernetes ConfigMaps/Secrets. No config files in images. |
| **Secrets** | Kubernetes Secrets, optionally HashiCorp Vault for production |
| **API Versioning** | URL path versioning: `/api/v1/...` |
| **Graceful Shutdown** | SIGTERM handler: stop accepting requests → drain connections → close DB pools → exit |
