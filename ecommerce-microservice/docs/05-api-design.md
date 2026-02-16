# 05 — API Design

## Overview

This document defines the REST API design, GraphQL schemas, API versioning strategy, and service contracts for the e-commerce microservice platform. All APIs follow consistent patterns for request/response formats, error handling, authentication, and documentation.

---

## API Design Principles

### 1. REST API Standards

All services expose REST APIs following these conventions:

| Principle | Implementation |
|-----------|----------------|
| **Resource-Based** | URLs represent resources: `/api/v1/users/{id}/addresses` |
| **HTTP Methods** | GET (read), POST (create), PUT/PATCH (update), DELETE (remove) |
| **Stateless** | No server-side session state; all context in requests |
| **Content Negotiation** | `Accept` and `Content-Type` headers for format selection |
| **Hypermedia** | Links in responses for discoverability (HAL or JSON:API) |
| **Idempotency** | PUT/PATCH/DELETE operations are idempotent |
| **Caching** | ETags and Cache-Control headers for HTTP caching |

### 2. API Versioning Strategy

**URL Path Versioning:** `/api/v1/resource`

**Reasons:**
- Clear contract evolution
- Backward compatibility maintenance
- Client can pin to specific versions
- Easy to deprecate and sunset versions

**Version Lifecycle:**
- **v1:** Current stable version
- **v2:** Next major version (breaking changes)
- **Sunset Policy:** 12 months deprecation notice, 24 months support

### 3. Authentication & Authorization

**JWT Bearer Tokens:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Claims:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "roles": ["customer", "admin"],
  "permissions": ["read:orders", "write:products"],
  "iat": 1640995200,
  "exp": 1641081600,
  "iss": "ecommerce-platform"
}
```

**Authorization Headers:**
- `X-API-Key`: Service-to-service authentication
- `X-Correlation-ID`: Request tracing
- `X-Idempotency-Key`: Duplicate prevention

### 4. Request/Response Formats

**Standard Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
X-Correlation-ID: req-12345678-abcd-efgh
X-Idempotency-Key: idem-87654321-hgfe-dcba
Accept: application/json
```

**Standard Response Headers:**
```
Content-Type: application/json
X-Correlation-ID: req-12345678-abcd-efgh
ETag: "etag-value"
Cache-Control: max-age=300
```

**Pagination Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false,
    "next_cursor": "cursor-token",
    "prev_cursor": null
  },
  "_links": {
    "self": "/api/v1/products?page=1&limit=20",
    "next": "/api/v1/products?page=2&limit=20",
    "prev": null
  }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Email format is invalid"
      }
    ],
    "correlation_id": "req-12345678-abcd-efgh",
    "timestamp": "2026-02-16T10:30:00Z"
  },
  "_links": {
    "documentation": "https://api.docs.com/errors/VALIDATION_ERROR"
  }
}
```

---

## REST API Specifications

### User Service API

#### Authentication Endpoints

**POST /api/v1/auth/login**
```json
// Request
{
  "email": "user@example.com",
  "password": "password123"
}

// Response 200
{
  "access_token": "eyJhbGci...",
  "refresh_token": "refresh-token-uuid",
  "expires_in": 3600,
  "token_type": "Bearer",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "roles": ["customer"]
  }
}
```

**POST /api/v1/auth/refresh**
```json
// Request
{
  "refresh_token": "refresh-token-uuid"
}

// Response 200 - Same as login
```

**POST /api/v1/auth/register**
```json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890"
}

// Response 201
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "email_verified": false
  },
  "verification_required": true
}
```

#### User Management Endpoints

**GET /api/v1/users/me**
```json
// Response 200
{
  "id": "user-uuid",
  "email": "user@example.com",
  "email_verified": true,
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "avatar_url": "https://cdn.example.com/avatar.jpg",
  "status": "active",
  "last_login_at": "2026-02-15T08:30:00Z",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-02-15T08:30:00Z"
}
```

**PUT /api/v1/users/me**
```json
// Request
{
  "first_name": "John",
  "last_name": "Smith",
  "phone": "+1987654321"
}

// Response 200 - Updated user object
```

**GET /api/v1/users/me/addresses**
```json
// Response 200
{
  "data": [
    {
      "id": "addr-uuid",
      "label": "home",
      "full_name": "John Doe",
      "line1": "123 Main St",
      "line2": "Apt 4B",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country_code": "US",
      "phone": "+1234567890",
      "is_default": true
    }
  ]
}
```

**POST /api/v1/users/me/addresses**
```json
// Request
{
  "label": "work",
  "full_name": "John Doe",
  "line1": "456 Office Blvd",
  "city": "New York",
  "state": "NY",
  "postal_code": "10002",
  "country_code": "US",
  "phone": "+1234567890",
  "is_default": false
}

// Response 201 - Created address object
```

### Product Service API

#### Product Catalog Endpoints

**GET /api/v1/products**
```json
// Query Parameters
?category=electronics&brand=apple&min_price=100&max_price=1000&rating=4&sort=-created_at&page=1&limit=20

// Response 200
{
  "data": [
    {
      "id": "prod-uuid",
      "sku": "APPLE-IPHONE-14",
      "name": "iPhone 14 Pro",
      "slug": "iphone-14-pro",
      "description": "Latest iPhone model",
      "short_description": "Pro camera system",
      "category_id": "cat-uuid",
      "category": {
        "id": "cat-uuid",
        "name": "Smartphones",
        "slug": "smartphones"
      },
      "brand": "Apple",
      "tags": ["smartphone", "ios", "5g"],
      "pricing": {
        "currency": "USD",
        "base_price": 999.00,
        "sale_price": 899.00,
        "sale_starts_at": "2026-02-01T00:00:00Z",
        "sale_ends_at": "2026-02-28T23:59:59Z"
      },
      "images": [
        {
          "url": "https://cdn.example.com/iphone14-1.jpg",
          "alt_text": "iPhone 14 Pro front view",
          "sort_order": 1,
          "is_primary": true
        }
      ],
      "variants": [
        {
          "sku": "IPHONE14-BLACK-128",
          "name": "Black 128GB",
          "attributes": {"color": "black", "storage": "128GB"},
          "price_override": null
        }
      ],
      "avg_rating": 4.5,
      "review_count": 1250,
      "status": "active",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "facets": {
    "categories": [
      {"value": "electronics", "count": 500, "label": "Electronics"}
    ],
    "brands": [
      {"value": "apple", "count": 150, "label": "Apple"}
    ],
    "price_ranges": [
      {"value": "0-100", "count": 200, "label": "$0 - $100"},
      {"value": "100-500", "count": 300, "label": "$100 - $500"}
    ]
  },
  "pagination": {...}
}
```

**GET /api/v1/products/{id}**
```json
// Response 200 - Full product object with variants, images, etc.
```

**GET /api/v1/products/search**
```json
// Query Parameters
?q=iphone&category=electronics&limit=10

// Response 200
{
  "query": "iphone",
  "data": [
    {
      "id": "prod-uuid",
      "name": "iPhone 14 Pro",
      "sku": "APPLE-IPHONE-14",
      "image_url": "https://cdn.example.com/iphone14-1.jpg",
      "pricing": {"currency": "USD", "base_price": 999.00},
      "avg_rating": 4.5,
      "review_count": 1250,
      "highlights": {
        "name": "<mark>iPhone</mark> 14 Pro"
      }
    }
  ],
  "total": 25,
  "took_ms": 45
}
```

#### Category Endpoints

**GET /api/v1/categories/tree**
```json
// Response 200
{
  "data": [
    {
      "id": "cat-electronics",
      "name": "Electronics",
      "slug": "electronics",
      "children": [
        {
          "id": "cat-phones",
          "name": "Smartphones",
          "slug": "smartphones",
          "product_count": 150
        }
      ],
      "product_count": 500
    }
  ]
}
```

### Cart Service API

#### Cart Endpoints

**GET /api/v1/cart**
```json
// Response 200
{
  "items": [
    {
      "product_id": "prod-uuid",
      "variant_sku": "IPHONE14-BLACK-128",
      "name": "iPhone 14 Pro",
      "image_url": "https://cdn.example.com/iphone14-1.jpg",
      "unit_price": 999.00,
      "quantity": 1,
      "line_total": 999.00,
      "added_at": "2026-02-16T10:00:00Z"
    }
  ],
  "summary": {
    "item_count": 1,
    "subtotal": 999.00,
    "discount": 0.00,
    "tax_estimate": 99.90,
    "shipping_estimate": 9.99,
    "total_estimate": 1108.89
  },
  "coupon_code": null,
  "expires_at": "2026-02-23T10:00:00Z"
}
```

**POST /api/v1/cart/items**
```json
// Request
{
  "product_id": "prod-uuid",
  "variant_sku": "IPHONE14-BLACK-128",
  "quantity": 1
}

// Response 201
{
  "item": {...},
  "cart": {...}
}
```

**PUT /api/v1/cart/items/{product_id}**
```json
// Request
{
  "variant_sku": "IPHONE14-BLACK-128",
  "quantity": 2
}

// Response 200
{
  "item": {...},
  "cart": {...}
}
```

**DELETE /api/v1/cart/items/{product_id}**
```json
// Response 204 No Content
```

### Order Service API

#### Order Endpoints

**GET /api/v1/orders**
```json
// Query Parameters
?status=completed&created_after=2026-01-01&limit=20

// Response 200
{
  "data": [
    {
      "id": "order-uuid",
      "order_number": "ORD-20260216-A1B2C3",
      "user_id": "user-uuid",
      "status": "delivered",
      "currency": "USD",
      "subtotal": 999.00,
      "tax_amount": 99.90,
      "shipping_amount": 9.99,
      "discount_amount": 0.00,
      "total_amount": 1108.89,
      "placed_at": "2026-02-16T11:00:00Z",
      "created_at": "2026-02-16T10:45:00Z",
      "items": [
        {
          "product_id": "prod-uuid",
          "variant_sku": "IPHONE14-BLACK-128",
          "product_name": "iPhone 14 Pro",
          "unit_price": 999.00,
          "quantity": 1,
          "line_total": 999.00
        }
      ],
      "_links": {
        "self": "/api/v1/orders/order-uuid",
        "user": "/api/v1/users/user-uuid",
        "payment": "/api/v1/payments?order_id=order-uuid",
        "shipping": "/api/v1/shipments?order_id=order-uuid"
      }
    }
  ],
  "pagination": {...}
}
```

**GET /api/v1/orders/{id}**
```json
// Response 200 - Full order details
```

**POST /api/v1/orders**
```json
// Request
{
  "idempotency_key": "idem-123456",
  "cart_snapshot": {
    "items": [
      {
        "product_id": "prod-uuid",
        "variant_sku": "IPHONE14-BLACK-128",
        "quantity": 1,
        "unit_price": 999.00
      }
    ],
    "coupon_code": null
  },
  "shipping_address": {
    "full_name": "John Doe",
    "line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country_code": "US",
    "phone": "+1234567890"
  },
  "billing_address": {...},
  "payment_method": {
    "type": "card",
    "token": "pm_card_token"
  }
}

// Response 201
{
  "order": {...},
  "payment_required": true,
  "client_secret": "pi_secret_..."
}
```

### Payment Service API

#### Payment Endpoints

**POST /api/v1/payments**
```json
// Request
{
  "order_id": "order-uuid",
  "idempotency_key": "idem-123456",
  "payment_method": {
    "type": "card",
    "card": {
      "number": "4242424242424242",
      "exp_month": 12,
      "exp_year": 2026,
      "cvc": "123"
    }
  },
  "amount": 1108.89,
  "currency": "USD"
}

// Response 201
{
  "id": "payment-uuid",
  "status": "succeeded",
  "amount": 1108.89,
  "currency": "USD",
  "paid_at": "2026-02-16T11:01:00Z"
}
```

**GET /api/v1/payments/{id}**
```json
// Response 200
{
  "id": "payment-uuid",
  "order_id": "order-uuid",
  "status": "succeeded",
  "amount": 1108.89,
  "currency": "USD",
  "payment_method": "card",
  "paid_at": "2026-02-16T11:01:00Z",
  "refunds": []
}
```

### Inventory Service API

#### Inventory Endpoints

**GET /api/v1/inventory**
```json
// Query Parameters
?product_id=prod-uuid&warehouse_code=WH-01

// Response 200
{
  "data": [
    {
      "id": "inv-uuid",
      "product_id": "prod-uuid",
      "variant_sku": null,
      "warehouse_code": "WH-01",
      "total_quantity": 100,
      "reserved_quantity": 5,
      "available_quantity": 95,
      "reorder_point": 10,
      "last_updated": "2026-02-16T10:00:00Z"
    }
  ]
}
```

**PUT /api/v1/inventory/{id}**
```json
// Request
{
  "total_quantity": 150,
  "reorder_point": 15
}

// Response 200 - Updated inventory
```

### Shipping Service API

#### Shipping Endpoints

**POST /api/v1/shipments**
```json
// Request
{
  "order_id": "order-uuid",
  "carrier": "ups",
  "service": "ground",
  "origin_address": {
    "line1": "123 Warehouse St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country_code": "US"
  },
  "destination_address": {...},
  "weight_kg": 0.5,
  "dimensions": {
    "length": 15,
    "width": 10,
    "height": 5,
    "unit": "cm"
  }
}

// Response 201
{
  "id": "ship-uuid",
  "order_id": "order-uuid",
  "carrier": "ups",
  "tracking_number": "1Z999AA1234567890",
  "tracking_url": "https://www.ups.com/track?tracknum=1Z999AA1234567890",
  "status": "label_created",
  "estimated_delivery": "2026-02-20",
  "shipping_cost": 9.99,
  "label_url": "https://api.ups.com/labels/..."
}
```

**GET /api/v1/shipments/{id}/tracking**
```json
// Response 200
{
  "shipment_id": "ship-uuid",
  "tracking_number": "1Z999AA1234567890",
  "carrier": "ups",
  "status": "in_transit",
  "estimated_delivery": "2026-02-20",
  "events": [
    {
      "status": "picked_up",
      "description": "Package picked up",
      "location": "New York, NY",
      "occurred_at": "2026-02-17T09:00:00Z"
    },
    {
      "status": "in_transit",
      "description": "Package in transit",
      "location": "Chicago, IL",
      "occurred_at": "2026-02-18T14:30:00Z"
    }
  ]
}
```

### Review Service API

#### Review Endpoints

**GET /api/v1/products/{product_id}/reviews**
```json
// Query Parameters
?page=1&limit=10&rating=4&verified_only=true&sort=-created_at

// Response 200
{
  "data": [
    {
      "id": "review-uuid",
      "product_id": "prod-uuid",
      "user_id": "user-uuid",
      "rating": 5,
      "title": "Amazing phone!",
      "body": "Best iPhone I've ever owned...",
      "verified_purchase": true,
      "helpful_count": 12,
      "images": [
        {"url": "https://cdn.example.com/review1.jpg", "caption": "Unboxing"}
      ],
      "reply": {
        "seller_id": "seller-uuid",
        "body": "Thank you for the review!",
        "replied_at": "2026-02-17T10:00:00Z"
      },
      "status": "approved",
      "created_at": "2026-02-16T12:00:00Z"
    }
  ],
  "summary": {
    "average_rating": 4.5,
    "total_reviews": 1250,
    "rating_distribution": {
      "5": 750,
      "4": 300,
      "3": 150,
      "2": 30,
      "1": 20
    }
  },
  "pagination": {...}
}
```

**POST /api/v1/products/{product_id}/reviews**
```json
// Request
{
  "rating": 5,
  "title": "Great product!",
  "body": "Highly recommend this item.",
  "images": [
    {"url": "https://cdn.example.com/upload.jpg", "caption": "Product in use"}
  ]
}

// Response 201 - Created review (pending moderation)
```

---

## GraphQL API Design

### Schema Overview

The platform provides GraphQL APIs for complex queries requiring multiple service calls and flexible data fetching.

**Endpoint:** `POST /graphql`

**Supported Services:**
- Product Service (catalog browsing)
- Order Service (order history with details)
- User Service (profile with addresses)

### Core Schema

```graphql
type Query {
  # Product queries
  products(
    filter: ProductFilter
    sort: ProductSort
    pagination: PaginationInput
  ): ProductConnection!
  
  product(id: ID!): Product
  
  # Order queries
  orders(
    filter: OrderFilter
    sort: OrderSort
    pagination: PaginationInput
  ): OrderConnection!
  
  order(id: ID!): Order
  
  # User queries
  me: User!
}

type Mutation {
  # Cart mutations
  addToCart(input: AddToCartInput!): Cart!
  updateCartItem(input: UpdateCartItemInput!): Cart!
  removeFromCart(productId: ID!): Cart!
  
  # Order mutations
  createOrder(input: CreateOrderInput!): Order!
  
  # Review mutations
  createReview(input: CreateReviewInput!): Review!
}

type Product {
  id: ID!
  sku: String!
  name: String!
  slug: String!
  description: String
  category: Category!
  brand: String
  pricing: Pricing!
  images: [Image!]!
  variants: [ProductVariant!]!
  reviews(filter: ReviewFilter, pagination: PaginationInput): ReviewConnection!
  avgRating: Float
  reviewCount: Int
  status: ProductStatus!
}

type Category {
  id: ID!
  name: String!
  slug: String!
  parent: Category
  children: [Category!]!
  productCount: Int
}

type Pricing {
  currency: String!
  basePrice: Decimal!
  salePrice: Decimal
  saleStartsAt: DateTime
  saleEndsAt: DateTime
}

type Order {
  id: ID!
  orderNumber: String!
  status: OrderStatus!
  currency: String!
  subtotal: Decimal!
  taxAmount: Decimal!
  shippingAmount: Decimal!
  discountAmount: Decimal!
  totalAmount: Decimal!
  items: [OrderItem!]!
  shippingAddress: Address!
  billingAddress: Address!
  payment: Payment
  shipment: Shipment
  placedAt: DateTime
  createdAt: DateTime!
}

type User {
  id: ID!
  email: String!
  firstName: String!
  lastName: String!
  phone: String
  avatarUrl: String
  addresses: [Address!]!
  orders(filter: OrderFilter, pagination: PaginationInput): OrderConnection!
  createdAt: DateTime!
}

type Cart {
  items: [CartItem!]!
  summary: CartSummary!
  couponCode: String
  expiresAt: DateTime!
}

# Input types
input ProductFilter {
  category: String
  brand: String
  minPrice: Decimal
  maxPrice: Decimal
  rating: Int
  tags: [String!]
  status: ProductStatus
}

input PaginationInput {
  first: Int
  after: String
  last: Int
  before: String
}

# Enums
enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

# Custom scalars
scalar Decimal
scalar DateTime
```

### Example Queries

**Product Catalog with Reviews:**
```graphql
query GetProducts($filter: ProductFilter, $pagination: PaginationInput) {
  products(filter: $filter, pagination: $pagination) {
    edges {
      node {
        id
        name
        pricing {
          basePrice
          salePrice
          currency
        }
        images {
          url
          isPrimary
        }
        avgRating
        reviewCount
        reviews(first: 3) {
          edges {
            node {
              rating
              title
              body
              verifiedPurchase
              createdAt
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

**Order History with Details:**
```graphql
query GetOrderHistory($pagination: PaginationInput) {
  me {
    orders(pagination: $pagination) {
      edges {
        node {
          id
          orderNumber
          status
          totalAmount
          currency
          placedAt
          items {
            productName
            unitPrice
            quantity
            lineTotal
          }
          shipment {
            trackingNumber
            carrier
            status
            estimatedDelivery
          }
        }
      }
    }
  }
}
```

**Cart Management:**
```graphql
mutation AddToCart($input: AddToCartInput!) {
  addToCart(input: $input) {
    items {
      productId
      name
      unitPrice
      quantity
      lineTotal
    }
    summary {
      itemCount
      subtotal
      totalEstimate
    }
  }
}
```

### GraphQL Implementation Notes

- **Federation:** Use Apollo Federation for service composition
- **Caching:** Implement persisted queries for performance
- **Validation:** Custom directives for authorization and input validation
- **Monitoring:** Apollo Studio for query analytics and performance monitoring

---

## API Contracts & Documentation

### OpenAPI Specification

All services provide OpenAPI 3.0 specifications:

- **Location:** `/api/v1/openapi.json`
- **Format:** JSON/YAML
- **Coverage:** All endpoints with examples
- **Validation:** Request/response schemas

### API Documentation

- **Swagger UI:** `/api/docs` - Interactive documentation
- **ReDoc:** `/api/redoc` - Clean documentation viewer
- **Postman Collection:** Available for download

### Contract Testing

- **Pact:** Consumer-driven contracts between services
- **Schema Validation:** JSON Schema for request/response validation
- **API Diffing:** Automated detection of breaking changes

### Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 10/min | per IP |
| Product browsing | 1000/min | per user |
| Order operations | 100/min | per user |
| Admin operations | 500/min | per user |

---

This API design provides a comprehensive, consistent, and scalable interface for the e-commerce platform, supporting both REST and GraphQL access patterns with proper versioning, authentication, and documentation.