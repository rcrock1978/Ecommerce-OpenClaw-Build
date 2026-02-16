# 07 — Security

## Overview

This document outlines the comprehensive security architecture for the e-commerce microservice platform, covering authentication, authorization, API security, data protection, and operational security best practices. The platform implements defense-in-depth security across all layers.

---

## Authentication & Authorization

### JWT Authentication

**Token Structure:**
```json
{
  "alg": "RS256",
  "typ": "JWT"
}
{
  "sub": "user-uuid-123",
  "email": "user@example.com",
  "roles": ["customer", "premium"],
  "permissions": ["read:orders", "write:cart", "read:products"],
  "scope": "api:read api:write",
  "iss": "https://api.ecommerce.com",
  "aud": "ecommerce-platform",
  "iat": 1640995200,
  "exp": 1641081600,
  "jti": "jwt-uuid-456"
}
```

**Token Issuance:**
- **Access Tokens:** Short-lived (15 minutes), used for API access
- **Refresh Tokens:** Long-lived (7 days), used to obtain new access tokens
- **ID Tokens:** Used by frontend for user identity information

**Implementation:**
```typescript
// JWT Service
class JWTService {
  async generateAccessToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: this.calculatePermissions(user.roles),
      scope: 'api:read api:write',
      iss: 'https://api.ecommerce.com',
      aud: 'ecommerce-platform',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
      jti: crypto.randomUUID()
    };

    return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      return jwt.verify(token, this.publicKey, {
        issuer: 'https://api.ecommerce.com',
        audience: 'ecommerce-platform',
        algorithms: ['RS256']
      });
    } catch (error) {
      throw new AuthenticationError('Invalid token');
    }
  }
}
```

### Role-Based Access Control (RBAC)

**Role Hierarchy:**
```
admin (full access)
├── seller (product management)
├── support (customer service)
├── moderator (content moderation)
└── customer (basic user)
    └── premium (enhanced features)
```

**Roles and Permissions:**

| Role | Permissions |
|------|-------------|
| **admin** | `*` (all permissions) |
| **seller** | `read:products`, `write:products`, `read:orders`, `read:inventory` |
| **support** | `read:users`, `read:orders`, `write:orders` (limited) |
| **moderator** | `read:reviews`, `write:reviews`, `moderate:content` |
| **customer** | `read:products`, `write:cart`, `read:orders` (own), `write:reviews` |
| **premium** | `customer` + `priority:support`, `early:access` |

**Permission Checking:**
```typescript
class AuthorizationService {
  hasPermission(user: User, requiredPermission: string): boolean {
    const userPermissions = this.calculatePermissions(user.roles);
    return userPermissions.includes(requiredPermission) ||
           userPermissions.includes('*');
  }

  hasRole(user: User, requiredRole: string): boolean {
    return user.roles.includes(requiredRole);
  }

  calculatePermissions(roles: string[]): string[] {
    const permissions = new Set<string>();

    for (const role of roles) {
      const rolePermissions = this.rolePermissions[role] || [];
      rolePermissions.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }
}
```

### API Gateway Security

**Kong Plugins Configuration:**

```yaml
# JWT Authentication Plugin
plugins:
  - name: jwt
    config:
      claims_to_verify: ["exp", "iss", "aud"]
      key_claim_name: "kid"
      maximum_expiration: 900
      run_on_preflight: false

# Rate Limiting Plugin
  - name: rate-limiting
    config:
      minute: 100
      hour: 1000
      policy: redis
      redis_host: redis-service

# Request Transformer Plugin
  - name: request-transformer
    config:
      add:
        headers:
          - "X-Forwarded-For: $remote_addr"
          - "X-Real-IP: $real_ip"
          - "X-Correlation-ID: $(uuid)"

# CORS Plugin
  - name: cors
    config:
      origins:
        - "https://store.ecommerce.com"
        - "https://admin.ecommerce.com"
      credentials: true
      headers:
        - "Authorization"
        - "Content-Type"
        - "X-Correlation-ID"
```

### Service-to-Service Authentication

**API Keys for Internal Services:**
```typescript
// API Key Authentication Middleware
class APIKeyAuthMiddleware {
  async authenticate(req: Request): Promise<ServiceIdentity> {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new AuthenticationError('API key required');
    }

    const service = await this.apiKeyRepository.findByKey(apiKey);

    if (!service || !service.active) {
      throw new AuthenticationError('Invalid API key');
    }

    return {
      serviceId: service.id,
      serviceName: service.name,
      permissions: service.permissions
    };
  }
}
```

---

## Data Protection

### Encryption at Rest

**Database Encryption:**

**PostgreSQL:**
```sql
-- Enable encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypted columns
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  encrypted_ssn TEXT, -- pgp_sym_encrypt(ssn, 'encryption-key')
  created_at TIMESTAMPTZ
);

-- Encrypt data
INSERT INTO users (email, encrypted_ssn)
VALUES (
  'user@example.com',
  pgp_sym_encrypt('123-45-6789', 'my-encryption-key')
);

-- Decrypt data
SELECT
  email,
  pgp_sym_decrypt(encrypted_ssn, 'my-encryption-key') as ssn
FROM users;
```

**MongoDB:**
```javascript
// Field-level encryption
const encryptedClient = new MongoClient(uri, {
  autoEncryption: {
    keyVaultNamespace: 'encryption.__keyVault',
    kmsProviders: {
      local: { key: localMasterKey }
    },
    schemaMap: {
      'ecommerce.users': {
        properties: {
          ssn: {
            encrypt: {
              algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic',
              keyId: [UUID('...')]
            }
          }
        }
      }
    }
  }
});
```

**Redis Encryption:**
- Use Redis Enterprise with encryption at rest
- Encrypt sensitive values before storing
- Use TLS for Redis connections

### Encryption in Transit

**TLS Configuration:**

```yaml
# Nginx/Kong TLS Configuration
server {
  listen 443 ssl http2;
  server_name api.ecommerce.com;

  ssl_certificate /etc/ssl/certs/ecommerce.crt;
  ssl_certificate_key /etc/ssl/private/ecommerce.key;

  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
  ssl_prefer_server_ciphers off;

  # HSTS
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

  # CSP
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'";

  location / {
    proxy_pass http://kong-gateway;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

**Database Connections:**
```typescript
// PostgreSQL SSL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca.crt').toString(),
    key: fs.readFileSync('/path/to/client.key').toString(),
    cert: fs.readFileSync('/path/to/client.crt').toString()
  }
});
```

### Data Sanitization & Validation

**Input Validation:**
```typescript
import { body, param, query, validationResult } from 'express-validator';

const createUserValidators = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Invalid first name'),
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format')
];

class ValidationMiddleware {
  static validate(validators: any[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      await Promise.all(validators.map(validator => validator.run(req)));

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: errors.array()
          }
        });
      }

      next();
    };
  }
}
```

**SQL Injection Prevention:**
```typescript
// Parameterized queries (preferred)
const user = await pool.query(
  'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
  [userId]
);

// OR use an ORM with built-in protection
const user = await User.findOne({
  where: { id: userId, deletedAt: null }
});
```

**XSS Prevention:**
```typescript
// Sanitize HTML input
import DOMPurify from 'dompurify';

const cleanHtml = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
  ALLOWED_ATTR: []
});
```

---

## API Security

### Request Security

**Rate Limiting:**
```typescript
// Express rate limiting
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => req.ip + req.body.email // Rate limit per email+IP
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'API rate limit exceeded',
  keyGenerator: (req) => req.user?.id || req.ip
});
```

**Request Size Limits:**
```typescript
// Limit request body size
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload limits
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    // Only allow specific file types
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});
```

### Response Security

**Security Headers:**
```typescript
// Helmet.js configuration
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://cdn.ecommerce.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

**Data Leakage Prevention:**
```typescript
// Remove sensitive data from responses
class UserSerializer {
  static serialize(user: User, context: 'public' | 'private' = 'public') {
    const baseData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt
    };

    if (context === 'private') {
      return {
        ...baseData,
        phone: user.phone,
        lastLoginAt: user.lastLoginAt,
        emailVerified: user.emailVerified
      };
    }

    return baseData;
  }
}
```

### API Versioning Security

**Version Validation:**
```typescript
class APIVersionMiddleware {
  static validateVersion(req: Request, res: Response, next: NextFunction) {
    const version = req.headers['accept-version'] || 'v1';

    // Check if version is supported
    const supportedVersions = ['v1'];
    if (!supportedVersions.includes(version)) {
      return res.status(400).json({
        error: {
          code: 'UNSUPPORTED_API_VERSION',
          message: `API version ${version} is not supported. Supported versions: ${supportedVersions.join(', ')}`
        }
      });
    }

    req.apiVersion = version;
    next();
  }
}
```

---

## Operational Security

### Secrets Management

**Environment Variables:**
```bash
# .env file (never commit)
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
STRIPE_SECRET_KEY=sk_live_...
REDIS_URL=rediss://user:pass@host:port/0
```

**Kubernetes Secrets:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ecommerce-secrets
type: Opaque
data:
  db-password: <base64-encoded>
  jwt-private-key: <base64-encoded>
  stripe-key: <base64-encoded>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  template:
    spec:
      containers:
      - name: user-service
        env:
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: ecommerce-secrets
              key: db-password
```

**HashiCorp Vault Integration:**
```typescript
class VaultService {
  async getSecret(path: string): Promise<any> {
    const response = await this.vaultClient.read(path);
    return response.data;
  }

  async rotatePassword(service: string): Promise<string> {
    // Generate new password
    const newPassword = crypto.randomBytes(32).toString('hex');

    // Update database
    await this.database.rotatePassword(service, newPassword);

    // Update Vault
    await this.vaultClient.write(`database/creds/${service}`, {
      password: newPassword
    });

    return newPassword;
  }
}
```

### Logging & Monitoring

**Security Event Logging:**
```typescript
class SecurityLogger {
  async logSecurityEvent(event: SecurityEvent) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      event_type: event.type,
      user_id: event.userId,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      correlation_id: event.correlationId,
      details: event.details,
      severity: this.calculateSeverity(event)
    };

    // Log to structured logger
    this.logger.warn(logEntry);

    // Send to SIEM system
    await this.siemClient.sendEvent(logEntry);

    // Alert on high-severity events
    if (logEntry.severity >= 8) {
      await this.alertService.sendAlert('High severity security event', logEntry);
    }
  }

  private calculateSeverity(event: SecurityEvent): number {
    const severityMap = {
      'login_failure': 3,
      'password_reset_attempt': 4,
      'unauthorized_access': 7,
      'suspicious_activity': 8,
      'data_breach_attempt': 10
    };

    return severityMap[event.type] || 5;
  }
}

// Usage
await securityLogger.logSecurityEvent({
  type: 'login_failure',
  userId: userId,
  ipAddress: req.ip,
  userAgent: req.get('User-Agent'),
  correlationId: req.correlationId,
  details: { reason: 'invalid_password', attempts: 3 }
});
```

### Incident Response

**Security Incident Response Plan:**

1. **Detection & Assessment (0-15 minutes)**
   - Automated alerts trigger response team
   - Initial assessment of impact and scope

2. **Containment (15-60 minutes)**
   - Isolate affected systems
   - Block malicious traffic
   - Preserve evidence

3. **Eradication (1-4 hours)**
   - Remove malicious code/components
   - Patch vulnerabilities
   - Rotate compromised credentials

4. **Recovery (4-24 hours)**
   - Restore systems from clean backups
   - Monitor for anomalies
   - Communicate with stakeholders

5. **Lessons Learned (1-7 days)**
   - Post-mortem analysis
   - Update security measures
   - Document findings

**Automated Response:**
```typescript
class IncidentResponseService {
  async handleSecurityAlert(alert: SecurityAlert) {
    // Log incident
    await this.incidentLogger.log(alert);

    // Auto-contain based on alert type
    switch (alert.type) {
      case 'brute_force_attack':
        await this.firewall.blockIP(alert.ipAddress, 3600);
        break;

      case 'sql_injection_attempt':
        await this.waf.blockPattern(alert.pattern);
        break;

      case 'data_exfiltration':
        await this.isolateService(alert.serviceId);
        break;
    }

    // Escalate to human response team
    await this.pagerduty.triggerIncident({
      title: `Security Alert: ${alert.type}`,
      description: alert.description,
      severity: alert.severity,
      details: alert
    });
  }
}
```

---

## Compliance & Best Practices

### PCI DSS Compliance (Payment Data)

**Requirements for Payment Service:**
- Encrypt card data in transit and at rest
- Never store full card numbers
- Use tokenization for recurring payments
- Regular security scans and penetration testing
- Maintain audit logs for all payment operations

**Implementation:**
```typescript
class PaymentSecurityService {
  async processPayment(paymentData: PaymentData): Promise<PaymentResult> {
    // Validate payment data
    this.validatePaymentData(paymentData);

    // Tokenize sensitive data
    const tokenizedData = await this.tokenizationService.tokenize(paymentData);

    // Process payment with tokenized data
    const result = await this.paymentGateway.charge(tokenizedData);

    // Log PCI-relevant events (without sensitive data)
    await this.pciLogger.logPaymentEvent({
      paymentId: result.id,
      amount: result.amount,
      status: result.status,
      timestamp: new Date()
    });

    return result;
  }

  private validatePaymentData(data: PaymentData) {
    // Luhn algorithm for card number validation
    if (!this.luhnCheck(data.cardNumber)) {
      throw new ValidationError('Invalid card number');
    }

    // Check expiry date
    const now = new Date();
    const expiry = new Date(data.expiryYear, data.expiryMonth - 1);
    if (expiry < now) {
      throw new ValidationError('Card expired');
    }
  }

  private luhnCheck(cardNumber: string): boolean {
    // Implementation of Luhn algorithm
    let sum = 0;
    let alternate = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i), 10);

      if (alternate) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      alternate = !alternate;
    }

    return sum % 10 === 0;
  }
}
```

### GDPR Compliance (Data Protection)

**Data Subject Rights:**
- Right to access personal data
- Right to rectification
- Right to erasure ("right to be forgotten")
- Right to data portability
- Right to restrict processing

**Implementation:**
```typescript
class GDPRComplianceService {
  async deleteUserData(userId: string) {
    // Soft delete user account
    await this.userService.softDelete(userId);

    // Anonymize order data
    await this.orderService.anonymizeOrders(userId);

    // Delete reviews
    await this.reviewService.deleteUserReviews(userId);

    // Remove from marketing lists
    await this.marketingService.unsubscribe(userId);

    // Log deletion for audit
    await this.auditLogger.logDataDeletion({
      userId,
      reason: 'user_request',
      deletedAt: new Date(),
      affectedServices: ['user', 'order', 'review', 'marketing']
    });
  }

  async exportUserData(userId: string): Promise<UserDataExport> {
    const [user, orders, reviews] = await Promise.all([
      this.userService.getUserData(userId),
      this.orderService.getUserOrders(userId),
      this.reviewService.getUserReviews(userId)
    ]);

    return {
      user,
      orders,
      reviews,
      exportDate: new Date(),
      format: 'json'
    };
  }
}
```

### Security Testing

**Automated Security Testing:**
```typescript
// Dependency vulnerability scanning
describe('Security: Dependencies', () => {
  it('should not have vulnerable dependencies', async () => {
    const auditResult = await exec('npm audit --audit-level moderate');
    expect(auditResult.exitCode).toBe(0);
  });
});

// SQL injection testing
describe('Security: SQL Injection', () => {
  it('should prevent SQL injection in user lookup', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    await expect(
      userService.findByEmail(maliciousInput)
    ).rejects.toThrow('Invalid email format');
  });
});

// Authentication testing
describe('Security: Authentication', () => {
  it('should reject expired JWT tokens', async () => {
    const expiredToken = generateExpiredToken();

    await expect(
      authService.verifyToken(expiredToken)
    ).rejects.toThrow('Token expired');
  });

  it('should enforce password complexity', async () => {
    const weakPasswords = ['password', '123456', 'qwerty'];

    for (const password of weakPasswords) {
      await expect(
        userService.createUser({ password })
      ).rejects.toThrow('Password does not meet complexity requirements');
    }
  });
});
```

---

This security architecture provides comprehensive protection across authentication, authorization, data protection, and operational security, ensuring the e-commerce platform meets industry standards and compliance requirements.