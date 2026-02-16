# 04 — Database Design

> Comprehensive database schemas for every microservice in the e-commerce platform.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [User Service (PostgreSQL)](#2-user-service-postgresql)
3. [Product Service (MongoDB)](#3-product-service-mongodb)
4. [Cart Service (Redis)](#4-cart-service-redis)
5. [Order Service (PostgreSQL)](#5-order-service-postgresql)
6. [Payment Service (PostgreSQL)](#6-payment-service-postgresql)
7. [Inventory Service (PostgreSQL)](#7-inventory-service-postgresql)
8. [Review Service (MongoDB)](#8-review-service-mongodb)
9. [Shipping Service (PostgreSQL)](#9-shipping-service-postgresql)
10. [Cross-Service ER Overview](#10-cross-service-er-overview)
11. [Migration Strategy](#11-migration-strategy)

---

## 1. Design Principles

| Principle | Detail |
|---|---|
| **Database-per-service** | Each microservice owns its data; no shared databases |
| **Polyglot persistence** | PostgreSQL for transactional data, MongoDB for flexible documents, Redis for ephemeral/hot data |
| **Soft deletes** | All entities use `deleted_at` timestamps instead of physical deletes |
| **Audit columns** | Every table/collection includes `created_at`, `updated_at` |
| **UUIDs** | Primary keys are `UUID v7` (time-sortable) across all PostgreSQL services |
| **UTC timestamps** | All timestamps stored as `TIMESTAMPTZ` (PostgreSQL) or ISODate (MongoDB) in UTC |
| **Optimistic locking** | Version columns where concurrent writes are expected |

---

## 2. User Service (PostgreSQL)

### 2.1 Tables

#### `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `email` | `VARCHAR(255)` | `NOT NULL UNIQUE` | Lowercase, trimmed |
| `email_verified` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | bcrypt/argon2 |
| `first_name` | `VARCHAR(100)` | `NOT NULL` | |
| `last_name` | `VARCHAR(100)` | `NOT NULL` | |
| `phone` | `VARCHAR(20)` | `UNIQUE` | E.164 format |
| `avatar_url` | `TEXT` | | S3/CDN URL |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'active'` | active, suspended, banned |
| `last_login_at` | `TIMESTAMPTZ` | | |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | Optimistic lock |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `deleted_at` | `TIMESTAMPTZ` | | Soft delete |

#### `roles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `name` | `VARCHAR(50)` | `NOT NULL UNIQUE` | customer, admin, seller, support |
| `description` | `TEXT` | | |
| `permissions` | `JSONB` | `NOT NULL DEFAULT '[]'` | Array of permission strings |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

#### `user_roles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | `UUID` | `FK → users(id) ON DELETE CASCADE` | |
| `role_id` | `UUID` | `FK → roles(id) ON DELETE CASCADE` | |
| `granted_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `granted_by` | `UUID` | `FK → users(id)` | Admin who assigned |
| | | `PK (user_id, role_id)` | Composite PK |

#### `addresses`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `user_id` | `UUID` | `FK → users(id) ON DELETE CASCADE, NOT NULL` | |
| `label` | `VARCHAR(50)` | `NOT NULL DEFAULT 'home'` | home, work, other |
| `full_name` | `VARCHAR(200)` | `NOT NULL` | Recipient name |
| `line1` | `VARCHAR(255)` | `NOT NULL` | |
| `line2` | `VARCHAR(255)` | | |
| `city` | `VARCHAR(100)` | `NOT NULL` | |
| `state` | `VARCHAR(100)` | `NOT NULL` | |
| `postal_code` | `VARCHAR(20)` | `NOT NULL` | |
| `country_code` | `CHAR(2)` | `NOT NULL` | ISO 3166-1 alpha-2 |
| `phone` | `VARCHAR(20)` | | |
| `is_default` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `deleted_at` | `TIMESTAMPTZ` | | Soft delete |

#### `refresh_tokens`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `user_id` | `UUID` | `FK → users(id) ON DELETE CASCADE, NOT NULL` | |
| `token_hash` | `VARCHAR(255)` | `NOT NULL UNIQUE` | SHA-256 of token |
| `device_info` | `JSONB` | | User-agent, IP, etc. |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | |
| `revoked_at` | `TIMESTAMPTZ` | | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

### 2.2 Indexes

```sql
-- users
CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_phone ON users (phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_users_status ON users (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users (created_at);

-- addresses
CREATE INDEX idx_addresses_user_id ON addresses (user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_addresses_user_default ON addresses (user_id) WHERE is_default = TRUE AND deleted_at IS NULL;

-- refresh_tokens
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at) WHERE revoked_at IS NULL;
```

### 2.3 ER Diagram

```
┌─────────────────────┐       ┌──────────────────┐
│       users          │       │      roles        │
├─────────────────────┤       ├──────────────────┤
│ id           UUID PK │◄──┐  │ id       UUID PK  │
│ email        VARCHAR │   │  │ name     VARCHAR   │
│ email_verified BOOL  │   │  │ description TEXT   │
│ password_hash VARCHAR│   │  │ permissions JSONB  │
│ first_name   VARCHAR │   │  │ created_at  TSTZ   │
│ last_name    VARCHAR │   │  │ updated_at  TSTZ   │
│ phone        VARCHAR │   │  └────────┬───────────┘
│ avatar_url   TEXT    │   │           │
│ status       VARCHAR │   │  ┌────────┴───────────┐
│ last_login_at TSTZ   │   │  │    user_roles       │
│ version      INT     │   │  ├────────────────────┤
│ created_at   TSTZ    │   ├──┤ user_id  UUID FK    │
│ updated_at   TSTZ    │   │  │ role_id  UUID FK ───┘
│ deleted_at   TSTZ    │   │  │ granted_at TSTZ     │
└──────────┬───────────┘   │  │ granted_by UUID FK──┐
           │               │  └─────────────────────┘
           │               │
  ┌────────┴──────────┐    │
  │    addresses       │    │
  ├───────────────────┤    │
  │ id        UUID PK  │    │
  │ user_id   UUID FK ─┘    │
  │ label     VARCHAR  │    │
  │ full_name VARCHAR  │    │
  │ line1     VARCHAR  │    │
  │ city      VARCHAR  │    │
  │ state     VARCHAR  │    │
  │ postal_code VARCHAR│    │
  │ country_code CHAR  │    │
  │ is_default BOOL    │    │
  └───────────────────┘    │
                            │
  ┌────────────────────┐   │
  │  refresh_tokens     │   │
  ├────────────────────┤   │
  │ id         UUID PK  │   │
  │ user_id    UUID FK ─┘   │
  │ token_hash VARCHAR  │
  │ device_info JSONB   │
  │ expires_at  TSTZ    │
  │ revoked_at  TSTZ    │
  └────────────────────┘
```

---

## 3. Product Service (MongoDB)

### 3.1 Collections

#### `products`

```json
{
  "_id": "ObjectId",
  "sku": "string — UNIQUE, indexed",
  "name": "string — required, text-indexed",
  "slug": "string — UNIQUE, indexed",
  "description": "string",
  "short_description": "string — max 500 chars",
  "category_id": "ObjectId — ref → categories",
  "brand": "string — indexed",
  "tags": ["string"],
  "attributes": {
    "color": "string",
    "size": "string",
    "weight_kg": "number",
    "material": "string"
  },
  "pricing": {
    "currency": "string — ISO 4217 (e.g. USD)",
    "base_price": "Decimal128 — required",
    "sale_price": "Decimal128 | null",
    "sale_starts_at": "ISODate | null",
    "sale_ends_at": "ISODate | null",
    "cost_price": "Decimal128 — internal only"
  },
  "images": [
    {
      "url": "string — required",
      "alt_text": "string",
      "sort_order": "number",
      "is_primary": "boolean"
    }
  ],
  "variants": [
    {
      "sku": "string — UNIQUE",
      "name": "string",
      "attributes": { "size": "L", "color": "blue" },
      "price_override": "Decimal128 | null",
      "is_active": "boolean"
    }
  ],
  "seo": {
    "meta_title": "string",
    "meta_description": "string",
    "canonical_url": "string"
  },
  "status": "string — enum: draft | active | archived",
  "seller_id": "string — UUID of seller, indexed",
  "avg_rating": "number — denormalized, 0-5",
  "review_count": "number — denormalized",
  "version": "number — optimistic lock",
  "created_at": "ISODate",
  "updated_at": "ISODate",
  "deleted_at": "ISODate | null"
}
```

#### `categories`

```json
{
  "_id": "ObjectId",
  "name": "string — required",
  "slug": "string — UNIQUE",
  "description": "string",
  "parent_id": "ObjectId | null — self-ref for tree",
  "path": "string — materialized path e.g. '/electronics/phones/smartphones'",
  "level": "number — depth in tree (0 = root)",
  "sort_order": "number",
  "image_url": "string",
  "is_active": "boolean — default true",
  "product_count": "number — denormalized",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

### 3.2 Indexes

```javascript
// products
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ slug: 1 }, { unique: true });
db.products.createIndex({ category_id: 1, status: 1 });
db.products.createIndex({ seller_id: 1, status: 1 });
db.products.createIndex({ brand: 1 });
db.products.createIndex({ tags: 1 });
db.products.createIndex({ "pricing.base_price": 1 });
db.products.createIndex({ status: 1, created_at: -1 });
db.products.createIndex({ "variants.sku": 1 }, { unique: true, sparse: true });
db.products.createIndex(
  { name: "text", description: "text", tags: "text" },
  { weights: { name: 10, tags: 5, description: 1 } }
);

// categories
db.categories.createIndex({ slug: 1 }, { unique: true });
db.categories.createIndex({ parent_id: 1 });
db.categories.createIndex({ path: 1 });
```

### 3.3 Document Relationship Diagram

```
┌──────────────────────────┐
│       categories          │
├──────────────────────────┤
│ _id          ObjectId PK  │◄─── parent_id (self-ref)
│ name         string        │
│ slug         string UNIQ   │
│ parent_id    ObjectId FK ──┘
│ path         string
│ level        number
│ product_count number
└──────────┬───────────────┘
           │ 1:N
           ▼
┌──────────────────────────┐
│        products           │
├──────────────────────────┤
│ _id          ObjectId PK  │
│ sku          string UNIQ   │
│ slug         string UNIQ   │
│ category_id  ObjectId FK   │
│ name         string        │
│ pricing      { embedded }  │
│ images       [ embedded ]  │  ◄── embedded sub-documents
│ variants     [ embedded ]  │  ◄── embedded sub-documents
│ attributes   { embedded }  │
│ seller_id    string (UUID) │
│ status       enum          │
└──────────────────────────┘
```

---

## 4. Cart Service (Redis)

### 4.1 Key Structures

Carts are ephemeral, high-read/write structures stored entirely in Redis.

#### Cart Hash

```
Key:     cart:{user_id}
Type:    HASH
TTL:     7 days (refreshed on each write)

Fields:
  item:{product_id}:{variant_sku}  →  JSON string
```

**Item value schema:**

```json
{
  "product_id": "uuid-string",
  "variant_sku": "string | null",
  "name": "string — snapshot at add-time",
  "image_url": "string",
  "unit_price": "12.99 — snapshot, re-validated at checkout",
  "quantity": 3,
  "added_at": "2026-01-15T10:30:00Z"
}
```

#### Cart Metadata

```
Key:     cart:{user_id}:meta
Type:    HASH
TTL:     7 days

Fields:
  coupon_code       → "SUMMER20"
  item_count        → "5"           (denormalized, updated on add/remove)
  updated_at        → "2026-01-15T10:30:00Z"
```

#### Anonymous Cart (guest users)

```
Key:     cart:anon:{session_id}
Type:    HASH
TTL:     24 hours

-- Merged into cart:{user_id} on login/signup
```

#### Cart Lock (during checkout)

```
Key:     cart:lock:{user_id}
Type:    STRING  →  "1"
TTL:     5 minutes
SET NX   (acquire lock; fail if already locked)
```

### 4.2 Access Patterns

| Operation | Commands |
|---|---|
| Add item | `HSET cart:{uid} item:{pid}:{sku} '{json}'` + `EXPIRE cart:{uid} 604800` |
| Remove item | `HDEL cart:{uid} item:{pid}:{sku}` |
| Update qty | `HSET` with updated JSON |
| Get full cart | `HGETALL cart:{uid}` |
| Clear cart | `DEL cart:{uid} cart:{uid}:meta` |
| Cart count | `HGET cart:{uid}:meta item_count` |
| Acquire lock | `SET cart:lock:{uid} 1 NX EX 300` |
| Release lock | `DEL cart:lock:{uid}` |

---

## 5. Order Service (PostgreSQL)

### 5.1 Tables

#### `orders`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `order_number` | `VARCHAR(30)` | `NOT NULL UNIQUE` | Human-readable: `ORD-20260215-A1B2C3` |
| `user_id` | `UUID` | `NOT NULL` | No FK — cross-service boundary |
| `status` | `VARCHAR(30)` | `NOT NULL DEFAULT 'pending'` | See enum below |
| `currency` | `CHAR(3)` | `NOT NULL DEFAULT 'USD'` | ISO 4217 |
| `subtotal` | `NUMERIC(12,2)` | `NOT NULL` | Sum of line items |
| `discount_amount` | `NUMERIC(12,2)` | `NOT NULL DEFAULT 0` | |
| `tax_amount` | `NUMERIC(12,2)` | `NOT NULL DEFAULT 0` | |
| `shipping_amount` | `NUMERIC(12,2)` | `NOT NULL DEFAULT 0` | |
| `total_amount` | `NUMERIC(12,2)` | `NOT NULL` | subtotal − discount + tax + shipping |
| `coupon_code` | `VARCHAR(50)` | | |
| `shipping_address` | `JSONB` | `NOT NULL` | Snapshot of address at order time |
| `billing_address` | `JSONB` | `NOT NULL` | |
| `notes` | `TEXT` | | Customer notes |
| `idempotency_key` | `VARCHAR(64)` | `UNIQUE` | Prevents duplicate orders |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `placed_at` | `TIMESTAMPTZ` | | When payment confirmed |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `deleted_at` | `TIMESTAMPTZ` | | |

**Order statuses:** `pending` → `confirmed` → `processing` → `shipped` → `delivered` → `completed` | `cancelled` | `refunded`

#### `order_items`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `order_id` | `UUID` | `FK → orders(id), NOT NULL` | |
| `product_id` | `UUID` | `NOT NULL` | Snapshot — no FK |
| `variant_sku` | `VARCHAR(100)` | | |
| `product_name` | `VARCHAR(255)` | `NOT NULL` | Snapshot |
| `product_image_url` | `TEXT` | | Snapshot |
| `unit_price` | `NUMERIC(12,2)` | `NOT NULL` | Price at time of order |
| `quantity` | `INTEGER` | `NOT NULL CHECK (quantity > 0)` | |
| `line_total` | `NUMERIC(12,2)` | `NOT NULL` | unit_price × quantity |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

#### `order_status_history`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `order_id` | `UUID` | `FK → orders(id), NOT NULL` | |
| `from_status` | `VARCHAR(30)` | | NULL for initial |
| `to_status` | `VARCHAR(30)` | `NOT NULL` | |
| `reason` | `TEXT` | | e.g. "Customer requested cancellation" |
| `changed_by` | `UUID` | | User or system UUID |
| `metadata` | `JSONB` | | Extra context |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

### 5.2 Indexes

```sql
CREATE INDEX idx_orders_user_id ON orders (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_status ON orders (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_order_number ON orders (order_number);
CREATE INDEX idx_orders_placed_at ON orders (placed_at DESC) WHERE placed_at IS NOT NULL;
CREATE UNIQUE INDEX idx_orders_idempotency ON orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);

CREATE INDEX idx_order_status_history_order ON order_status_history (order_id, created_at);
```

### 5.3 ER Diagram

```
┌──────────────────────────┐
│         orders            │
├──────────────────────────┤
│ id              UUID PK   │
│ order_number    VARCHAR    │
│ user_id         UUID       │
│ status          VARCHAR    │
│ subtotal        NUMERIC    │
│ discount_amount NUMERIC    │
│ tax_amount      NUMERIC    │
│ shipping_amount NUMERIC    │
│ total_amount    NUMERIC    │
│ shipping_address JSONB     │
│ billing_address  JSONB     │
│ idempotency_key VARCHAR    │
│ placed_at       TSTZ       │
│ created_at      TSTZ       │
└─────────┬────────────────┘
          │ 1:N                    1:N
          ├──────────────────────────┐
          ▼                          ▼
┌──────────────────────┐  ┌─────────────────────────┐
│    order_items        │  │  order_status_history     │
├──────────────────────┤  ├─────────────────────────┤
│ id         UUID PK    │  │ id          UUID PK       │
│ order_id   UUID FK    │  │ order_id    UUID FK       │
│ product_id UUID       │  │ from_status VARCHAR       │
│ variant_sku VARCHAR   │  │ to_status   VARCHAR       │
│ product_name VARCHAR  │  │ reason      TEXT          │
│ unit_price NUMERIC    │  │ changed_by  UUID          │
│ quantity   INT        │  │ metadata    JSONB         │
│ line_total NUMERIC    │  │ created_at  TSTZ          │
└──────────────────────┘  └─────────────────────────┘
```

---

## 6. Payment Service (PostgreSQL)

### 6.1 Tables

#### `payments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `order_id` | `UUID` | `NOT NULL` | Cross-service ref |
| `user_id` | `UUID` | `NOT NULL` | |
| `idempotency_key` | `VARCHAR(64)` | `NOT NULL UNIQUE` | Client-generated |
| `payment_method` | `VARCHAR(30)` | `NOT NULL` | card, paypal, bank_transfer, wallet |
| `provider` | `VARCHAR(30)` | `NOT NULL` | stripe, paypal, adyen |
| `provider_payment_id` | `VARCHAR(255)` | `UNIQUE` | External reference |
| `provider_response` | `JSONB` | | Raw gateway response |
| `currency` | `CHAR(3)` | `NOT NULL` | |
| `amount` | `NUMERIC(12,2)` | `NOT NULL CHECK (amount > 0)` | |
| `status` | `VARCHAR(30)` | `NOT NULL DEFAULT 'pending'` | pending, processing, succeeded, failed, cancelled |
| `failure_reason` | `TEXT` | | |
| `paid_at` | `TIMESTAMPTZ` | | |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

#### `refunds`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `payment_id` | `UUID` | `FK → payments(id), NOT NULL` | |
| `idempotency_key` | `VARCHAR(64)` | `NOT NULL UNIQUE` | |
| `provider_refund_id` | `VARCHAR(255)` | `UNIQUE` | |
| `amount` | `NUMERIC(12,2)` | `NOT NULL CHECK (amount > 0)` | Partial or full |
| `reason` | `VARCHAR(50)` | `NOT NULL` | customer_request, defective, duplicate, fraud |
| `notes` | `TEXT` | | |
| `status` | `VARCHAR(30)` | `NOT NULL DEFAULT 'pending'` | pending, processing, succeeded, failed |
| `initiated_by` | `UUID` | `NOT NULL` | Admin or system UUID |
| `refunded_at` | `TIMESTAMPTZ` | | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

### 6.2 Indexes

```sql
CREATE INDEX idx_payments_order_id ON payments (order_id);
CREATE INDEX idx_payments_user_id ON payments (user_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_provider_id ON payments (provider_payment_id) WHERE provider_payment_id IS NOT NULL;

CREATE INDEX idx_refunds_payment_id ON refunds (payment_id);
CREATE INDEX idx_refunds_status ON refunds (status);
```

### 6.3 ER Diagram

```
┌────────────────────────────┐
│         payments            │
├────────────────────────────┤
│ id                 UUID PK  │
│ order_id           UUID     │
│ user_id            UUID     │
│ idempotency_key    VARCHAR  │
│ payment_method     VARCHAR  │
│ provider           VARCHAR  │
│ provider_payment_id VARCHAR │
│ currency           CHAR(3)  │
│ amount             NUMERIC  │
│ status             VARCHAR  │
│ paid_at            TSTZ     │
└──────────┬─────────────────┘
           │ 1:N
           ▼
┌────────────────────────────┐
│          refunds            │
├────────────────────────────┤
│ id                UUID PK   │
│ payment_id        UUID FK   │
│ idempotency_key   VARCHAR   │
│ provider_refund_id VARCHAR  │
│ amount            NUMERIC   │
│ reason            VARCHAR   │
│ status            VARCHAR   │
│ initiated_by      UUID      │
│ refunded_at       TSTZ      │
└────────────────────────────┘
```

---

## 7. Inventory Service (PostgreSQL)

### 7.1 Tables

#### `inventory`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `product_id` | `UUID` | `NOT NULL` | Cross-service ref |
| `variant_sku` | `VARCHAR(100)` | | NULL = base product |
| `warehouse_code` | `VARCHAR(20)` | `NOT NULL DEFAULT 'WH-01'` | |
| `total_quantity` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (total_quantity >= 0)` | Physical stock |
| `reserved_quantity` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0)` | Held for pending orders |
| `available_quantity` | `INTEGER` | `GENERATED ALWAYS AS (total_quantity - reserved_quantity) STORED` | |
| `reorder_point` | `INTEGER` | `NOT NULL DEFAULT 10` | Alert threshold |
| `reorder_quantity` | `INTEGER` | `NOT NULL DEFAULT 50` | Auto-reorder amount |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | Optimistic lock |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

| | | `UNIQUE (product_id, variant_sku, warehouse_code)` | |

#### `reservations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `inventory_id` | `UUID` | `FK → inventory(id), NOT NULL` | |
| `order_id` | `UUID` | `NOT NULL` | Cross-service ref |
| `quantity` | `INTEGER` | `NOT NULL CHECK (quantity > 0)` | |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'held'` | held, confirmed, released, expired |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Auto-release after expiry (15 min) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

### 7.2 Indexes

```sql
CREATE UNIQUE INDEX idx_inventory_product_warehouse
  ON inventory (product_id, COALESCE(variant_sku, ''), warehouse_code);
CREATE INDEX idx_inventory_low_stock
  ON inventory (product_id) WHERE available_quantity <= reorder_point;

CREATE INDEX idx_reservations_inventory ON reservations (inventory_id);
CREATE INDEX idx_reservations_order ON reservations (order_id);
CREATE INDEX idx_reservations_expires ON reservations (expires_at)
  WHERE status = 'held';
CREATE INDEX idx_reservations_status ON reservations (status);
```

### 7.3 ER Diagram

```
┌──────────────────────────────────┐
│           inventory               │
├──────────────────────────────────┤
│ id                UUID PK         │
│ product_id        UUID            │
│ variant_sku       VARCHAR         │
│ warehouse_code    VARCHAR         │
│ total_quantity    INT             │
│ reserved_quantity INT             │
│ available_quantity INT (generated) │
│ reorder_point     INT             │
│ version           INT             │
└───────────┬──────────────────────┘
            │ 1:N
            ▼
┌──────────────────────────┐
│      reservations         │
├──────────────────────────┤
│ id            UUID PK     │
│ inventory_id  UUID FK     │
│ order_id      UUID        │
│ quantity      INT         │
│ status        VARCHAR     │
│ expires_at    TSTZ        │
└──────────────────────────┘
```

---

## 8. Review Service (MongoDB)

### 8.1 Collections

#### `reviews`

```json
{
  "_id": "ObjectId",
  "product_id": "string — UUID, indexed",
  "user_id": "string — UUID, indexed",
  "order_id": "string — UUID — verified purchase proof",
  "rating": "number — required, 1-5, indexed",
  "title": "string — max 200 chars",
  "body": "string — max 5000 chars",
  "images": [
    {
      "url": "string",
      "caption": "string"
    }
  ],
  "verified_purchase": "boolean — default false",
  "helpful_count": "number — default 0",
  "report_count": "number — default 0",
  "status": "string — enum: pending | approved | rejected | flagged",
  "moderation": {
    "reviewed_by": "string | null — admin UUID",
    "reviewed_at": "ISODate | null",
    "reason": "string | null"
  },
  "reply": {
    "seller_id": "string — UUID",
    "body": "string",
    "replied_at": "ISODate"
  },
  "created_at": "ISODate",
  "updated_at": "ISODate",
  "deleted_at": "ISODate | null"
}
```

### 8.2 Indexes

```javascript
db.reviews.createIndex({ product_id: 1, created_at: -1 });
db.reviews.createIndex({ product_id: 1, rating: 1 });
db.reviews.createIndex({ user_id: 1, created_at: -1 });
db.reviews.createIndex(
  { product_id: 1, user_id: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } }
);  // One review per product per user
db.reviews.createIndex({ status: 1 });
db.reviews.createIndex({ created_at: -1 });
```

---

## 9. Shipping Service (PostgreSQL)

### 9.1 Tables

#### `shipments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `order_id` | `UUID` | `NOT NULL` | Cross-service ref |
| `carrier` | `VARCHAR(50)` | `NOT NULL` | ups, fedex, dhl, usps |
| `carrier_service` | `VARCHAR(50)` | | ground, express, overnight |
| `tracking_number` | `VARCHAR(100)` | `UNIQUE` | |
| `tracking_url` | `TEXT` | | Carrier tracking page |
| `status` | `VARCHAR(30)` | `NOT NULL DEFAULT 'pending'` | pending, label_created, picked_up, in_transit, out_for_delivery, delivered, returned, lost |
| `estimated_delivery` | `DATE` | | |
| `actual_delivery` | `TIMESTAMPTZ` | | |
| `shipping_cost` | `NUMERIC(10,2)` | | |
| `weight_kg` | `NUMERIC(8,3)` | | |
| `dimensions` | `JSONB` | | `{ "length": 30, "width": 20, "height": 15, "unit": "cm" }` |
| `origin_address` | `JSONB` | `NOT NULL` | Warehouse address |
| `destination_address` | `JSONB` | `NOT NULL` | Customer address snapshot |
| `label_url` | `TEXT` | | Shipping label PDF |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

#### `tracking_events`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | |
| `shipment_id` | `UUID` | `FK → shipments(id), NOT NULL` | |
| `status` | `VARCHAR(50)` | `NOT NULL` | |
| `description` | `TEXT` | | Carrier-provided detail |
| `location` | `VARCHAR(255)` | | City, state, country |
| `occurred_at` | `TIMESTAMPTZ` | `NOT NULL` | When the event happened (carrier time) |
| `raw_event` | `JSONB` | | Raw carrier webhook payload |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

### 9.2 Indexes

```sql
CREATE INDEX idx_shipments_order_id ON shipments (order_id);
CREATE INDEX idx_shipments_tracking ON shipments (tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX idx_shipments_status ON shipments (status);
CREATE INDEX idx_shipments_carrier ON shipments (carrier, status);

CREATE INDEX idx_tracking_events_shipment ON tracking_events (shipment_id, occurred_at DESC);
```

### 9.3 ER Diagram

```
┌───────────────────────────┐
│        shipments           │
├───────────────────────────┤
│ id               UUID PK   │
│ order_id         UUID      │
│ carrier          VARCHAR   │
│ tracking_number  VARCHAR   │
│ status           VARCHAR   │
│ estimated_delivery DATE    │
│ origin_address   JSONB     │
│ destination_address JSONB  │
└──────────┬────────────────┘
           │ 1:N
           ▼
┌───────────────────────────┐
│     tracking_events        │
├───────────────────────────┤
│ id            UUID PK      │
│ shipment_id   UUID FK      │
│ status        VARCHAR      │
│ description   TEXT         │
│ location      VARCHAR      │
│ occurred_at   TSTZ         │
│ raw_event     JSONB        │
└───────────────────────────┘
```

---

## 10. Cross-Service ER Overview

```
                          ┌─────────────┐
                          │  User Svc    │
                          │  (Postgres)  │
                          │  users       │
                          │  addresses   │
                          │  roles       │
                          └──────┬───────┘
                                 │ user_id
            ┌────────────────────┼──────────────────────┐
            ▼                    ▼                       ▼
   ┌────────────────┐  ┌────────────────┐     ┌────────────────┐
   │  Cart Svc       │  │  Review Svc    │     │  Order Svc     │
   │  (Redis)        │  │  (MongoDB)     │     │  (Postgres)    │
   │  cart:{uid}     │  │  reviews       │     │  orders        │
   └────────┬───────┘  └───────┬────────┘     │  order_items   │
            │ product_id       │ product_id    │  status_history│
            ▼                  ▼               └───┬───┬───────┘
   ┌────────────────┐  ┌──────────────┐            │   │
   │  Product Svc    │  │  (aggregates │       order│   │order_id
   │  (MongoDB)      │◄─┤   rating)    │       _id  │   │
   │  products       │  └──────────────┘            │   │
   │  categories     │                              ▼   ▼
   └────────┬───────┘                    ┌──────────────────┐
            │ product_id                 │  Payment Svc      │
            ▼                            │  (Postgres)       │
   ┌────────────────┐                    │  payments         │
   │  Inventory Svc  │                   │  refunds          │
   │  (Postgres)     │                   └──────────────────┘
   │  inventory      │                              │
   │  reservations   │                         order_id
   └────────────────┘                              ▼
                                         ┌──────────────────┐
                                         │  Shipping Svc     │
                                         │  (Postgres)       │
                                         │  shipments        │
                                         │  tracking_events  │
                                         └──────────────────┘
```

> **Note:** Arrows represent logical references via IDs — there are **no foreign keys across service boundaries**. Each service stores only the UUID of external entities.

---

## 11. Migration Strategy

### 11.1 Tool

All PostgreSQL services use **[golang-migrate](https://github.com/golang-migrate/migrate)** (or Flyway/Liquibase depending on team preference). MongoDB uses application-level migrations via a custom `migrations` collection.

### 11.2 Naming Convention

```
{timestamp}_{description}.up.sql
{timestamp}_{description}.down.sql

Example:
20260215120000_create_users_table.up.sql
20260215120000_create_users_table.down.sql
```

### 11.3 Rules

| Rule | Detail |
|---|---|
| **Always reversible** | Every `up` migration has a corresponding `down` |
| **Additive first** | Add columns as nullable → backfill → add constraint (multi-deploy) |
| **No breaking changes** | Never rename/drop columns in use; deprecate, then remove after 2 releases |
| **Transactional** | Wrap each migration in `BEGIN ... COMMIT` |
| **Idempotent** | Use `IF NOT EXISTS` / `IF EXISTS` guards |
| **Schema per service** | Each service connects to its own PostgreSQL database |
| **CI gating** | Migrations run in CI against a test DB; failures block deploy |

### 11.4 Example Migration

```sql
-- 20260215120000_create_users_table.up.sql
BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    avatar_url      TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at   TIMESTAMPTZ,
    version         INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users (email) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
    ON users (phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

COMMIT;
```

```sql
-- 20260215120000_create_users_table.down.sql
BEGIN;
DROP TRIGGER IF EXISTS set_users_updated_at ON users;
DROP TABLE IF EXISTS users;
COMMIT;
```

### 11.5 MongoDB Migration Tracking

```json
// migrations collection document
{
  "_id": "20260215120000_add_product_variants",
  "applied_at": "2026-02-15T12:00:00Z",
  "checksum": "sha256:abc123...",
  "execution_time_ms": 342
}
```

Migrations are idempotent scripts that:
1. Check if already applied via the `migrations` collection
2. Run the forward transformation
3. Insert a migration record
4. Support rollback via a paired `down` function

---

*This document is the source of truth for all data models. Changes must be reviewed and approved via PR before migration scripts are written.*
