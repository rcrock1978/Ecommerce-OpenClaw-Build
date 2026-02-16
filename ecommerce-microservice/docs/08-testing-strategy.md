# 08 — Testing Strategy

## Overview

This document defines a comprehensive testing strategy for the e-commerce microservice platform, covering unit tests, integration tests, end-to-end tests, and test automation. The strategy ensures high code quality, reliable deployments, and fast feedback loops.

---

## Testing Pyramid

### Test Distribution

```
┌─────────────────────────────────────┐ 10%
│         End-to-End Tests             │
│     (User Journey Validation)       │
└─────────────────────────────────────┘
          ┌─────────────────────────────┐ 20%
          │    Integration Tests        │
          │  (Service Interaction)      │
          └─────────────────────────────┘
                   ┌─────────────────────┐ 70%
                   │     Unit Tests       │
                   │   (Business Logic)   │
                   └─────────────────────┘
```

**Test Execution Time Goals:**
- **Unit Tests:** < 5 minutes for full suite
- **Integration Tests:** < 15 minutes
- **E2E Tests:** < 30 minutes

---

## Unit Testing

### Framework & Tools

**Node.js Services:**
```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts']
};
```

**Go Services:**
```go
// Payment service testing setup
func TestMain(m *testing.M) {
    // Setup test database
    testDB := setupTestDatabase()
    defer testDB.Close()

    // Run tests
    code := m.Run()

    // Cleanup
    teardownTestDatabase(testDB)

    os.Exit(code)
}
```

### Unit Test Patterns

#### 1. Domain Logic Testing

**Product Service - Pricing Logic:**
```typescript
describe('Product Pricing', () => {
  let pricingService: PricingService;

  beforeEach(() => {
    pricingService = new PricingService();
  });

  describe('calculateDiscount', () => {
    it('should apply percentage discount correctly', () => {
      const product = {
        basePrice: 100,
        discountPercent: 20
      };

      const result = pricingService.calculateDiscount(product);

      expect(result).toBe(20); // 20% of 100
    });

    it('should not apply discount if not active', () => {
      const product = {
        basePrice: 100,
        discountPercent: 20,
        discountActive: false
      };

      const result = pricingService.calculateDiscount(product);

      expect(result).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(() => pricingService.calculateDiscount({
        basePrice: -100,
        discountPercent: 20
      })).toThrow('Invalid base price');

      expect(() => pricingService.calculateDiscount({
        basePrice: 100,
        discountPercent: 150
      })).toThrow('Invalid discount percentage');
    });
  });
});
```

#### 2. Repository Testing

**User Repository - Database Operations:**
```typescript
describe('UserRepository', () => {
  let repository: UserRepository;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      getClient: jest.fn()
    } as any;

    repository = new UserRepository(mockDb);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe'
      };

      mockDb.query.mockResolvedValue({ rows: [mockUser] });

      const result = await repository.findById(userId);

      expect(result).toEqual(mockUser);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
        [userId]
      );
    });

    it('should return null when user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.findById('user-123'))
        .rejects.toThrow('Database connection failed');
    });
  });
});
```

#### 3. Service Layer Testing

**Order Service - Business Logic:**
```typescript
describe('OrderService', () => {
  let orderService: OrderService;
  let mockOrderRepo: jest.Mocked<OrderRepository>;
  let mockProductService: jest.Mocked<ProductService>;
  let mockInventoryService: jest.Mocked<InventoryService>;

  beforeEach(() => {
    mockOrderRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn()
    };

    mockProductService = {
      getProduct: jest.fn(),
      validateProducts: jest.fn()
    };

    mockInventoryService = {
      reserveInventory: jest.fn(),
      releaseInventory: jest.fn()
    };

    orderService = new OrderService(
      mockOrderRepo,
      mockProductService,
      mockInventoryService
    );
  });

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      const orderData = {
        userId: 'user-123',
        items: [
          { productId: 'prod-1', quantity: 2, unitPrice: 50 }
        ]
      };

      const expectedOrder = {
        id: 'order-456',
        ...orderData,
        totalAmount: 100,
        status: 'pending'
      };

      mockProductService.validateProducts.mockResolvedValue(true);
      mockInventoryService.reserveInventory.mockResolvedValue(true);
      mockOrderRepo.create.mockResolvedValue(expectedOrder);

      const result = await orderService.createOrder(orderData);

      expect(result).toEqual(expectedOrder);
      expect(mockProductService.validateProducts).toHaveBeenCalled();
      expect(mockInventoryService.reserveInventory).toHaveBeenCalled();
    });

    it('should rollback inventory on order creation failure', async () => {
      mockProductService.validateProducts.mockResolvedValue(true);
      mockInventoryService.reserveInventory.mockResolvedValue(true);
      mockOrderRepo.create.mockRejectedValue(new Error('Database error'));

      await expect(orderService.createOrder(orderData))
        .rejects.toThrow('Database error');

      expect(mockInventoryService.releaseInventory).toHaveBeenCalled();
    });
  });
});
```

### Test Data Management

**Factory Pattern for Test Data:**
```typescript
class TestDataFactory {
  static createUser(overrides: Partial<User> = {}): User {
    return {
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      email: `user${Date.now()}@example.com`,
      firstName: 'John',
      lastName: 'Doe',
      password: 'hashed-password',
      status: 'active',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createProduct(overrides: Partial<Product> = {}): Product {
    return {
      id: 'prod-' + Math.random().toString(36).substr(2, 9),
      sku: 'TEST-SKU-' + Date.now(),
      name: 'Test Product',
      description: 'Test product description',
      basePrice: 99.99,
      currency: 'USD',
      status: 'active',
      categoryId: 'cat-123',
      brand: 'Test Brand',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createOrder(overrides: Partial<Order> = {}): Order {
    return {
      id: 'order-' + Math.random().toString(36).substr(2, 9),
      orderNumber: 'ORD-' + Date.now(),
      userId: 'user-123',
      status: 'pending',
      currency: 'USD',
      subtotal: 199.98,
      totalAmount: 219.98,
      createdAt: new Date(),
      ...overrides
    };
  }
}

// Usage in tests
describe('OrderService', () => {
  it('should calculate order total correctly', () => {
    const user = TestDataFactory.createUser();
    const product = TestDataFactory.createProduct({ basePrice: 50 });
    const order = TestDataFactory.createOrder({
      userId: user.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 50 }]
    });

    // Test logic...
  });
});
```

---

## Integration Testing

### Database Integration Tests

**Test Database Setup:**
```typescript
// test-db-setup.ts
import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import { createClient as createRedisClient } from 'redis';

export class TestDatabaseManager {
  private postgresPool: Pool;
  private mongoClient: MongoClient;
  private redisClient: any;

  async setup() {
    // PostgreSQL
    this.postgresPool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'ecommerce_test',
      user: 'test_user',
      password: 'test_password',
      max: 5,
      idleTimeoutMillis: 30000
    });

    // Run migrations
    await this.runMigrations();

    // MongoDB
    this.mongoClient = new MongoClient('mongodb://localhost:27017/ecommerce_test');
    await this.mongoClient.connect();

    // Redis
    this.redisClient = createRedisClient({ url: 'redis://localhost:6379/1' });
    await this.redisClient.connect();
  }

  async teardown() {
    await this.postgresPool.end();
    await this.mongoClient.close();
    await this.redisClient.quit();
  }

  async cleanup() {
    // Clean all test data
    await this.postgresPool.query('TRUNCATE TABLE users, orders, products CASCADE');
    await this.mongoClient.db().collection('products').deleteMany({});
    await this.redisClient.flushDb();
  }

  private async runMigrations() {
    // Run database migrations for test schema
    const fs = require('fs');
    const path = require('path');

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    for (const file of migrationFiles) {
      const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await this.postgresPool.query(migration);
    }
  }
}
```

**Repository Integration Test:**
```typescript
describe('UserRepository Integration', () => {
  let dbManager: TestDatabaseManager;
  let repository: UserRepository;

  beforeAll(async () => {
    dbManager = new TestDatabaseManager();
    await dbManager.setup();
    repository = new UserRepository(dbManager.getPostgresPool());
  });

  afterAll(async () => {
    await dbManager.teardown();
  });

  beforeEach(async () => {
    await dbManager.cleanup();
  });

  describe('CRUD operations', () => {
    it('should create and retrieve user', async () => {
      const userData = TestDataFactory.createUser({
        email: 'integration@example.com'
      });

      const createdUser = await repository.create(userData);
      expect(createdUser.id).toBeDefined();

      const retrievedUser = await repository.findById(createdUser.id);
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should handle concurrent updates with optimistic locking', async () => {
      const user = await repository.create(TestDataFactory.createUser());

      // Simulate concurrent updates
      const update1 = repository.update(user.id, { firstName: 'John1' }, 1);
      const update2 = repository.update(user.id, { firstName: 'John2' }, 1);

      await expect(Promise.all([update1, update2]))
        .rejects.toThrow('Concurrent modification detected');
    });
  });
});
```

### Service Integration Tests

**Order Creation Integration:**
```typescript
describe('Order Creation Integration', () => {
  let dbManager: TestDatabaseManager;
  let orderService: OrderService;
  let productService: ProductService;
  let inventoryService: InventoryService;
  let eventPublisher: EventPublisher;

  beforeAll(async () => {
    dbManager = new TestDatabaseManager();
    await dbManager.setup();

    // Initialize services with test dependencies
    const orderRepo = new OrderRepository(dbManager.getPostgresPool());
    const productRepo = new ProductRepository(dbManager.getMongoClient());
    const inventoryRepo = new InventoryRepository(dbManager.getPostgresPool());

    eventPublisher = new MockEventPublisher(); // Mock for testing

    orderService = new OrderService(orderRepo, eventPublisher);
    productService = new ProductService(productRepo);
    inventoryService = new InventoryService(inventoryRepo);
  });

  afterAll(async () => {
    await dbManager.teardown();
  });

  beforeEach(async () => {
    await dbManager.cleanup();
  });

  it('should create complete order with all validations', async () => {
    // Setup test data
    const user = await createTestUser(dbManager);
    const product = await createTestProduct(dbManager);
    await createTestInventory(dbManager, product.id, 10);

    const orderData = {
      userId: user.id,
      items: [{
        productId: product.id,
        quantity: 2,
        unitPrice: product.basePrice
      }]
    };

    // Execute order creation
    const order = await orderService.createOrder(orderData);

    // Verify order was created
    expect(order.id).toBeDefined();
    expect(order.status).toBe('pending');
    expect(order.totalAmount).toBe(200); // 2 * 100

    // Verify inventory was reserved
    const inventory = await inventoryService.getInventory(product.id);
    expect(inventory.reservedQuantity).toBe(2);
    expect(inventory.availableQuantity).toBe(8);

    // Verify event was published
    expect(eventPublisher.publishedEvents).toContainEqual({
      type: 'order.placed',
      data: expect.objectContaining({
        orderId: order.id,
        totalAmount: 200
      })
    });
  });
});
```

### API Integration Tests

**Using Supertest:**
```typescript
import request from 'supertest';
import { app } from '../src/app';
import { TestDatabaseManager } from './test-db-setup';

describe('User API Integration', () => {
  let dbManager: TestDatabaseManager;
  let server: any;

  beforeAll(async () => {
    dbManager = new TestDatabaseManager();
    await dbManager.setup();

    // Start test server
    server = app.listen(0); // Random port
  });

  afterAll(async () => {
    server.close();
    await dbManager.teardown();
  });

  beforeEach(async () => {
    await dbManager.cleanup();
  });

  describe('POST /api/v1/users', () => {
    it('should create user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(server)
        .post('/api/v1/users')
        .send(userData)
        .expect(201);

      expect(response.body.user).toMatchObject({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName
      });
      expect(response.body.user.id).toBeDefined();
      expect(response.body.user.password).toBeUndefined(); // Should not return password
    });

    it('should validate required fields', async () => {
      const response = await request(server)
        .post('/api/v1/users')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'email' })
      );
    });

    it('should prevent duplicate emails', async () => {
      // Create first user
      await request(server)
        .post('/api/v1/users')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe'
        })
        .expect(201);

      // Try to create duplicate
      const response = await request(server)
        .post('/api/v1/users')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
          firstName: 'Jane',
          lastName: 'Smith'
        })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });
  });
});
```

---

## End-to-End Testing

### E2E Test Framework

**Using Playwright:**
```typescript
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
};

export default config;
```

### User Journey Tests

**Complete Purchase Flow:**
```typescript
import { test, expect } from '@playwright/test';
import { TestDataFactory } from '../test-data-factory';

test.describe('Complete Purchase Flow', () => {
  test('should allow user to purchase product from search to delivery', async ({ page }) => {
    // Setup test data
    const user = TestDataFactory.createUser();
    const product = TestDataFactory.createProduct({
      name: 'iPhone 14 Pro',
      basePrice: 999.00
    });

    // Seed database with test data
    await seedDatabase({ user, product });

    // User authentication
    await page.goto('/login');
    await page.fill('[data-testid="email"]', user.email);
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');

    // Product search
    await page.goto('/search');
    await page.fill('[data-testid="search-input"]', 'iPhone 14');
    await page.click('[data-testid="search-button"]');

    // Verify search results
    await expect(page.locator('[data-testid="product-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="product-name"]')).toContainText('iPhone 14 Pro');
    await expect(page.locator('[data-testid="product-price"]')).toContainText('$999.00');

    // Add to cart
    await page.click('[data-testid="add-to-cart-button"]');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

    // Go to cart
    await page.click('[data-testid="cart-link"]');
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="cart-total"]')).toContainText('$999.00');

    // Checkout
    await page.click('[data-testid="checkout-button"]');

    // Shipping information
    await page.fill('[data-testid="first-name"]', 'John');
    await page.fill('[data-testid="last-name"]', 'Doe');
    await page.fill('[data-testid="address"]', '123 Main St');
    await page.fill('[data-testid="city"]', 'New York');
    await page.fill('[data-testid="zip"]', '10001');
    await page.click('[data-testid="continue-to-payment"]');

    // Payment information (using test card)
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="expiry"]', '1226');
    await page.fill('[data-testid="cvc"]', '123');
    await page.click('[data-testid="place-order"]');

    // Order confirmation
    await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible();
    const orderNumber = await page.locator('[data-testid="order-number"]').textContent();

    // Verify order in database
    const order = await getOrderByNumber(orderNumber);
    expect(order.status).toBe('confirmed');
    expect(order.totalAmount).toBe(999.00);

    // Email verification (mock email service)
    const emails = await getSentEmails(user.email);
    expect(emails).toContainEqual(
      expect.objectContaining({
        subject: 'Order Confirmation',
        body: expect.stringContaining(orderNumber)
      })
    );
  });
});
```

### API E2E Tests

**Order Processing Flow:**
```typescript
test.describe('Order Processing E2E', () => {
  test('should process order from creation to fulfillment', async ({ request }) => {
    // Setup test data
    const user = await createTestUser();
    const product = await createTestProduct();
    await createTestInventory(product.id, 10);

    // Authenticate and get token
    const authResponse = await request.post('/api/v1/auth/login', {
      data: {
        email: user.email,
        password: 'testpassword'
      }
    });
    const { access_token } = await authResponse.json();

    // Create order
    const orderResponse = await request.post('/api/v1/orders', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      },
      data: {
        idempotencyKey: `test-${Date.now()}`,
        items: [{
          productId: product.id,
          quantity: 1,
          unitPrice: product.basePrice
        }],
        shippingAddress: {
          fullName: 'John Doe',
          line1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          countryCode: 'US'
        },
        paymentMethod: {
          type: 'card',
          token: 'tok_test_card'
        }
      }
    });

    expect(orderResponse.status()).toBe(201);
    const { order } = await orderResponse.json();

    // Verify order was created
    expect(order.status).toBe('confirmed');
    expect(order.totalAmount).toBe(product.basePrice);

    // Wait for async processing (inventory, payment, shipping)
    await waitForEvent('payment.succeeded', { orderId: order.id });
    await waitForEvent('inventory.reserved', { orderId: order.id });
    await waitForEvent('shipping.label_created', { orderId: order.id });

    // Verify final order status
    const finalOrderResponse = await request.get(`/api/v1/orders/${order.id}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const finalOrder = await finalOrderResponse.json();
    expect(finalOrder.status).toBe('shipped');
    expect(finalOrder.shipment.trackingNumber).toBeDefined();
  });
});
```

---

## Test Automation & CI/CD

### CI Pipeline Configuration

**GitHub Actions:**
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run unit tests
      run: npm run test:unit
      env:
        DATABASE_URL: postgresql://postgres:test@localhost:5432/ecommerce_test
        REDIS_URL: redis://localhost:6379/1

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  integration-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
      mongodb:
        image: mongo:7
        options: >-
          --health-cmd mongo --eval 'db.runCommand("ping")'
      redis:
        image: redis:7
      kafka:
        image: confluentinc/cp-kafka:7.3.0
        env:
          KAFKA_BROKER_ID: 1
          KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
          KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_INTERNAL:PLAINTEXT
          KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092,PLAINTEXT_INTERNAL://broker:29092
          KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
          KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
          KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1

    steps:
    - uses: actions/checkout@v3

    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:test@localhost:5432/ecommerce_test
        MONGODB_URL: mongodb://localhost:27017/ecommerce_test
        REDIS_URL: redis://localhost:6379/1
        KAFKA_BROKERS: localhost:9092

  e2e-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
      mongodb:
        image: mongo:7
      redis:
        image: redis:7
      kafka:
        image: confluentinc/cp-kafka:7.3.0

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'

    - name: Install Playwright
      run: npx playwright install

    - name: Run E2E tests
      run: npm run test:e2e
      env:
        BASE_URL: http://localhost:3000

    - uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

### Test Data Management

**Test Database Seeding:**
```typescript
// test-data-seed.ts
export class TestDataSeeder {
  constructor(
    private postgres: Pool,
    private mongo: MongoClient,
    private redis: RedisClient
  ) {}

  async seedAll() {
    await this.seedUsers();
    await this.seedProducts();
    await this.seedCategories();
    await this.seedInventory();
  }

  async seedUsers() {
    const users = [
      TestDataFactory.createUser({
        email: 'customer@example.com',
        roles: ['customer']
      }),
      TestDataFactory.createUser({
        email: 'admin@example.com',
        roles: ['admin']
      })
    ];

    for (const user of users) {
      await this.postgres.query(
        'INSERT INTO users (id, email, first_name, last_name, password_hash, roles, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [user.id, user.email, user.firstName, user.lastName, user.password, JSON.stringify(user.roles), user.createdAt, user.updatedAt]
      );
    }
  }

  async seedProducts() {
    const products = [
      TestDataFactory.createProduct({
        name: 'iPhone 14 Pro',
        basePrice: 999.00,
        sku: 'APPLE-IPHONE-14'
      }),
      TestDataFactory.createProduct({
        name: 'Samsung Galaxy S23',
        basePrice: 799.00,
        sku: 'SAMSUNG-GALAXY-S23'
      })
    ];

    const collection = this.mongo.db('ecommerce_test').collection('products');

    for (const product of products) {
      await collection.insertOne({
        ...product,
        _id: new ObjectId(product.id)
      });
    }
  }
}
```

### Performance Testing

**Load Testing with k6:**
```typescript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'], // 99% of requests should be below 500ms
    http_req_failed: ['rate<0.1'],   // Error rate should be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Product search
  const searchResponse = http.get(`${BASE_URL}/api/v1/products/search?q=iphone`);
  check(searchResponse, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 200ms': (r) => r.timings.duration < 200,
  });

  // Product details
  const productResponse = http.get(`${BASE_URL}/api/v1/products/prod-123`);
  check(productResponse, {
    'product status is 200': (r) => r.status === 200,
    'product response time < 100ms': (r) => r.timings.duration < 100,
  });

  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}
```

---

This comprehensive testing strategy ensures code quality, prevents regressions, and validates the entire system from unit level to end-to-end user journeys, with automated execution in CI/CD pipelines.