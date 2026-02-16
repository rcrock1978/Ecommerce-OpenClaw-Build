import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),
  version: process.env.npm_package_version || '1.0.0',

  // Database
  mongodb: {
    uri: process.env.MONGODB_URL || 'mongodb://localhost:27017/productdb',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },

  // Elasticsearch
  elasticsearch: {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    auth: process.env.ELASTICSEARCH_AUTH ? {
      username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
      password: process.env.ELASTICSEARCH_PASSWORD || ''
    } : undefined,
    maxRetries: 3,
    requestTimeout: 60000,
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: {
      product: 3600, // 1 hour
      category: 7200, // 2 hours
      search: 1800, // 30 minutes
    }
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    issuer: process.env.JWT_ISSUER || 'product-service',
    audience: process.env.JWT_AUDIENCE || 'ecommerce-platform',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // Tracing
  tracing: {
    serviceName: 'product-service',
    jaeger: {
      endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger-collector:14268/api/traces',
    },
  },

  // Metrics
  metrics: {
    prefix: 'product_service_',
  },

  // External services
  services: {
    userService: {
      url: process.env.USER_SERVICE_URL || 'http://user-service:3001',
      timeout: 5000,
    },
    inventoryService: {
      url: process.env.INVENTORY_SERVICE_URL || 'http://inventory-service:3006',
      timeout: 5000,
    },
  },

  // Pagination
  pagination: {
    defaultLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT || '20', 10),
    maxLimit: parseInt(process.env.MAX_PAGE_LIMIT || '100', 10),
  },

  // File upload
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
};