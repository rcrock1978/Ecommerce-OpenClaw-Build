# 09 — Deployment

## Overview

This document defines the deployment strategy for the e-commerce microservice platform, covering containerization with Docker, orchestration with Kubernetes, and CI/CD pipelines with GitHub Actions. The strategy ensures reliable, scalable, and automated deployments across environments.

---

## Containerization with Docker

### Base Images & Multi-Stage Builds

**Node.js Service Dockerfile:**
```dockerfile
# Base stage for dependencies
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Dependencies stage
FROM base AS dependencies

# Install all dependencies (including dev dependencies)
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM dependencies AS development

# Install dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build

# Copy dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

# Change ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js

# Expose port
EXPOSE 3000

# Start production server
CMD ["dumb-init", "node", "dist/server.js"]
```

**Go Service Dockerfile:**
```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder

# Install git and ca-certificates (for external API calls)
RUN apk update && apk add --no-cache git ca-certificates && update-ca-certificates

# Create appuser
ENV USER=appuser
ENV UID=10001

# Create user
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    "${USER}"

WORKDIR /build

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download
RUN go mod verify

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o payment-service \
    ./cmd/server

# Final stage
FROM scratch

# Import from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

# Copy binary
COPY --from=builder /build/payment-service /payment-service

# Use non-root user
USER appuser:appuser

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/payment-service", "--health-check"]

# Run the binary
CMD ["/payment-service"]
```

### Docker Compose for Local Development

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  # API Gateway
  kong:
    image: kong:3.4
    ports:
      - "8000:8000"
      - "8443:8443"
      - "8001:8001"
      - "8444:8444"
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_USER: kong
      KONG_PG_PASSWORD: kongpass
      KONG_PG_DATABASE: kong
    depends_on:
      - kong-database
    networks:
      - ecommerce

  kong-database:
    image: postgres:16
    environment:
      POSTGRES_DB: kong
      POSTGRES_USER: kong
      POSTGRES_PASSWORD: kongpass
    volumes:
      - kong_data:/var/lib/postgresql/data
    networks:
      - ecommerce

  # User Service
  user-service:
    build:
      context: ./services/user-service
      dockerfile: Dockerfile
      target: development
    ports:
      - "3001:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://user:password@user-db:5432/userdb
      REDIS_URL: redis://redis:6379
    depends_on:
      - user-db
      - redis
    volumes:
      - ./services/user-service:/app
      - /app/node_modules
    networks:
      - ecommerce

  user-db:
    image: postgres:16
    environment:
      POSTGRES_DB: userdb
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5433:5432"
    volumes:
      - user_db_data:/var/lib/postgresql/data
    networks:
      - ecommerce

  # Product Service
  product-service:
    build:
      context: ./services/product-service
      dockerfile: Dockerfile
      target: development
    ports:
      - "3002:3000"
    environment:
      NODE_ENV: development
      MONGODB_URL: mongodb://product-db:27017/productdb
      REDIS_URL: redis://redis:6379
      ELASTICSEARCH_URL: http://elasticsearch:9200
    depends_on:
      - product-db
      - redis
      - elasticsearch
    volumes:
      - ./services/product-service:/app
      - /app/node_modules
    networks:
      - ecommerce

  product-db:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - product_db_data:/data/db
    networks:
      - ecommerce

  # Order Service
  order-service:
    build:
      context: ./services/order-service
      dockerfile: Dockerfile
      target: development
    ports:
      - "3004:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://order:password@order-db:5432/orderdb
      REDIS_URL: redis://redis:6379
      KAFKA_BROKERS: kafka:9092
    depends_on:
      - order-db
      - redis
      - kafka
    volumes:
      - ./services/order-service:/app
      - /app/node_modules
    networks:
      - ecommerce

  order-db:
    image: postgres:16
    environment:
      POSTGRES_DB: orderdb
      POSTGRES_USER: order
      POSTGRES_PASSWORD: password
    ports:
      - "5435:5432"
    volumes:
      - order_db_data:/var/lib/postgresql/data
    networks:
      - ecommerce

  # Payment Service
  payment-service:
    build:
      context: ./services/payment-service
      dockerfile: Dockerfile
    ports:
      - "3005:3005"
    environment:
      DATABASE_URL: postgresql://payment:password@payment-db:5432/paymentdb
      KAFKA_BROKERS: kafka:9092
      STRIPE_SECRET_KEY: sk_test_...
    depends_on:
      - payment-db
      - kafka
    networks:
      - ecommerce

  payment-db:
    image: postgres:16
    environment:
      POSTGRES_DB: paymentdb
      POSTGRES_USER: payment
      POSTGRES_PASSWORD: password
    ports:
      - "5436:5432"
    volumes:
      - payment_db_data:/var/lib/postgresql/data
    networks:
      - ecommerce

  # Redis (shared cache)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - ecommerce

  # Kafka
  zookeeper:
    image: confluentinc/cp-zookeeper:7.3.0
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    networks:
      - ecommerce

  kafka:
    image: confluentinc/cp-kafka:7.3.0
    ports:
      - "9092:9092"
      - "9101:9101"
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
    networks:
      - ecommerce

  # Elasticsearch
  elasticsearch:
    image: elasticsearch:8.7.0
    ports:
      - "9200:9200"
      - "9300:9300"
    environment:
      discovery.type: single-node
      xpack.security.enabled: false
      ES_JAVA_OPTS: "-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - ecommerce

  # Kibana
  kibana:
    image: kibana:8.7.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    networks:
      - ecommerce

volumes:
  kong_data:
  user_db_data:
  product_db_data:
  order_db_data:
  payment_db_data:
  redis_data:
  elasticsearch_data:

networks:
  ecommerce:
    driver: bridge
```

---

## Kubernetes Orchestration

### Namespace Strategy

```yaml
# namespaces.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ecommerce-prod
  labels:
    name: ecommerce-prod
    environment: production
---
apiVersion: v1
kind: Namespace
metadata:
  name: ecommerce-staging
  labels:
    name: ecommerce-staging
    environment: staging
---
apiVersion: v1
kind: Namespace
metadata:
  name: ecommerce-dev
  labels:
    name: ecommerce-dev
    environment: development
```

### ConfigMaps & Secrets

**ConfigMap:**
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ecommerce-config
  namespace: ecommerce-prod
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  KAFKA_BROKERS: "kafka-cluster:9092"
  REDIS_URL: "redis://redis-cluster:6379"
  ELASTICSEARCH_URL: "http://elasticsearch-cluster:9200"
```

**Secrets:**
```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ecommerce-secrets
  namespace: ecommerce-prod
type: Opaque
data:
  # Base64 encoded values
  DATABASE_PASSWORD: cGFzc3dvcmQ=  # password
  JWT_SECRET_KEY: bXktc2VjcmV0LWtleQ==  # my-secret-key
  STRIPE_SECRET_KEY: c2tfbGl2ZV8xMjM=  # sk_live_123
  MONGODB_PASSWORD: bW9uZ29wYXNz  # mongopass
```

### Service Deployments

**User Service Deployment:**
```yaml
# user-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: ecommerce-prod
  labels:
    app: user-service
    version: v1.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
        version: v1.0.0
    spec:
      containers:
      - name: user-service
        image: ecommerce/user-service:v1.0.0
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: ecommerce-config
              key: NODE_ENV
        - name: DATABASE_URL
          value: "postgresql://user:$(DATABASE_PASSWORD)@user-db:5432/userdb"
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: ecommerce-secrets
              key: DATABASE_PASSWORD
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: ecommerce-config
              key: REDIS_URL
        livenessProbe:
          httpGet:
            path: /health/live
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: logs
        emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - user-service
              topologyKey: kubernetes.io/hostname
```

**User Service Service:**
```yaml
# user-service-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: ecommerce-prod
  labels:
    app: user-service
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: http
    protocol: TCP
    name: http
  selector:
    app: user-service
```

**User Database StatefulSet:**
```yaml
# user-db-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: user-db
  namespace: ecommerce-prod
spec:
  serviceName: user-db
  replicas: 1
  selector:
    matchLabels:
      app: user-db
  template:
    metadata:
      labels:
        app: user-db
    spec:
      containers:
      - name: postgres
        image: postgres:16
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          value: userdb
        - name: POSTGRES_USER
          value: user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: ecommerce-secrets
              key: DATABASE_PASSWORD
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - user
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - user
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
      storageClassName: fast-ssd
```

### Ingress Configuration

**Kong Ingress:**
```yaml
# kong-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ecommerce-api
  namespace: ecommerce-prod
  annotations:
    kubernetes.io/ingress.class: "kong"
    konghq.com/strip-path: "true"
    konghq.com/plugins: "rate-limiting, jwt, cors"
spec:
  rules:
  - host: api.ecommerce.com
    http:
      paths:
      - path: /api/v1/users
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 80
      - path: /api/v1/products
        pathType: Prefix
        backend:
          service:
            name: product-service
            port:
              number: 80
      - path: /api/v1/orders
        pathType: Prefix
        backend:
          service:
            name: order-service
            port:
              number: 80
      - path: /api/v1/payments
        pathType: Prefix
        backend:
          service:
            name: payment-service
            port:
              number: 80
      - path: /api/v1/cart
        pathType: Prefix
        backend:
          service:
            name: cart-service
            port:
              number: 80
```

### Kong Plugins

**Rate Limiting Plugin:**
```yaml
# kong-rate-limiting.yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rate-limiting
  namespace: ecommerce-prod
config:
  minute: 100
  hour: 1000
  policy: redis
  redis_host: redis-cluster
  redis_port: 6379
```

**JWT Plugin:**
```yaml
# kong-jwt.yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: jwt
  namespace: ecommerce-prod
config:
  claims_to_verify:
    - "exp"
    - "iss"
    - "aud"
  key_claim_name: "kid"
  maximum_expiration: 900
  run_on_preflight: false
```

### Horizontal Pod Autoscaling

**HPA for User Service:**
```yaml
# user-service-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
  namespace: ecommerce-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Max
```

### Persistent Volumes

**Storage Classes:**
```yaml
# storage-classes.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
reclaimPolicy: Retain
allowVolumeExpansion: true
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "1000"
  throughput: "125"
reclaimPolicy: Retain
allowVolumeExpansion: true
```

---

## CI/CD with GitHub Actions

### Build & Test Pipeline

**.github/workflows/build-and-test.yml:**
```yaml
name: Build and Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
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
      mongodb:
        image: mongo:7
        options: >-
          --health-cmd mongo --eval 'db.runCommand("ping")'

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run unit tests
      run: npm run test:unit
      env:
        DATABASE_URL: postgresql://postgres:test@localhost:5432/ecommerce_test
        REDIS_URL: redis://localhost:6379
        MONGODB_URL: mongodb://localhost:27017/ecommerce_test

    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:test@localhost:5432/ecommerce_test
        REDIS_URL: redis://localhost:6379
        MONGODB_URL: mongodb://localhost:27017/ecommerce_test
        KAFKA_BROKERS: localhost:9092

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Docker buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push Docker images
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

### Deployment Pipeline

**.github/workflows/deploy.yml:**
```yaml
name: Deploy to Environment

on:
  push:
    branches: [ main ]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'staging' }}

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG }}

    - name: Setup Helm
      uses: azure/setup-helm@v3
      with:
        version: v3.12.0

    - name: Deploy to Kubernetes
      run: |
        # Set image tag
        export IMAGE_TAG=${{ github.sha }}
        
        # Update Helm values
        envsubst < k8s/values-${{ github.event.inputs.environment || 'staging' }}.yaml > k8s/values-deploy.yaml
        
        # Deploy using Helm
        helm upgrade --install ecommerce ./k8s/helm \
          --namespace ecommerce-${{ github.event.inputs.environment || 'staging' }} \
          --values k8s/values-deploy.yaml \
          --wait \
          --timeout 10m

    - name: Run post-deployment tests
      run: |
        # Wait for services to be ready
        kubectl wait --for=condition=available --timeout=300s deployment/user-service -n ecommerce-${{ github.event.inputs.environment || 'staging' }}
        kubectl wait --for=condition=available --timeout=300s deployment/product-service -n ecommerce-${{ github.event.inputs.environment || 'staging' }}
        
        # Run smoke tests
        npm run test:smoke -- --env ${{ github.event.inputs.environment || 'staging' }}

    - name: Rollback on failure
      if: failure()
      run: |
        # Rollback to previous version
        helm rollback ecommerce -n ecommerce-${{ github.event.inputs.environment || 'staging' }}
```

### Helm Chart Structure

**k8s/helm/Chart.yaml:**
```yaml
apiVersion: v2
name: ecommerce
description: E-commerce microservices platform
type: application
version: 1.0.0
appVersion: "1.0.0"
```

**k8s/helm/values.yaml:**
```yaml
# Global values
global:
  imageRegistry: ghcr.io
  imageRepository: your-org/ecommerce-microservice
  imageTag: latest
  environment: production

# Service configurations
userService:
  replicaCount: 3
  image:
    repository: user-service
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"
  env:
    DATABASE_URL: postgresql://user:${DATABASE_PASSWORD}@user-db:5432/userdb

productService:
  replicaCount: 3
  image:
    repository: product-service
  env:
    MONGODB_URL: mongodb://${MONGODB_USER}:${MONGODB_PASSWORD}@product-db:27017/productdb

# Database configurations
postgresql:
  enabled: true
  auth:
    postgresPassword: ${POSTGRES_PASSWORD}
    username: ecommerce
    password: ${DATABASE_PASSWORD}
    database: ecommerce

mongodb:
  enabled: true
  auth:
    rootPassword: ${MONGODB_ROOT_PASSWORD}
    usernames: ["ecommerce"]
    passwords: ["${MONGODB_PASSWORD}"]
    databases: ["productdb"]

redis:
  enabled: true
  auth:
    password: ${REDIS_PASSWORD}

kafka:
  enabled: true
  replicas: 3

elasticsearch:
  enabled: true
  replicas: 1
```

### Blue-Green Deployment Strategy

**Blue-Green Deployment Job:**
```yaml
# blue-green-deploy.yml (partial)
- name: Create green environment
  run: |
    # Create green namespace
    kubectl create namespace ecommerce-green --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy to green
    helm upgrade --install ecommerce-green ./k8s/helm \
      --namespace ecommerce-green \
      --set global.environment=green \
      --wait

- name: Run tests on green
  run: |
    # Run comprehensive tests against green environment
    npm run test:e2e -- --env green
    
    # Run load tests
    npm run test:load -- --env green

- name: Switch traffic to green
  run: |
    # Update ingress to point to green services
    kubectl patch ingress ecommerce-api -n ecommerce-prod \
      --type=json \
      -p='[{"op": "replace", "path": "/spec/rules/0/http/paths/0/backend/service/name", "value": "user-service-green"}]'
    
    # Or use service mesh traffic splitting
    kubectl apply -f k8s/traffic-splitting-green-100.yaml

- name: Monitor and rollback if needed
  run: |
    # Monitor error rates and latency
    sleep 300  # Wait 5 minutes
    
    ERROR_RATE=$(kubectl get hpa user-service-green -n ecommerce-green -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}')
    
    if [ "$ERROR_RATE" -gt 5 ]; then
      echo "High error rate detected, rolling back"
      # Switch traffic back to blue
      kubectl apply -f k8s/traffic-splitting-blue-100.yaml
    else
      echo "Deployment successful, cleaning up blue environment"
      helm uninstall ecommerce-blue -n ecommerce-blue
    fi
```

### Monitoring & Alerting

**Prometheus ServiceMonitor:**
```yaml
# prometheus-servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ecommerce-services
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: ecommerce
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
  namespaceSelector:
    matchNames:
    - ecommerce-prod
```

**AlertManager Rules:**
```yaml
# alert-rules.yaml
groups:
- name: ecommerce.rules
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }}% for {{ $labels.service }}"

  - alert: PodRestarting
    expr: rate(kube_pod_container_status_restarts_total[5m]) > 0
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Pod restarting frequently"
      description: "Pod {{ $labels.pod }} is restarting"

  - alert: DatabaseConnectionIssues
    expr: pg_stat_activity_count{state="idle"} > 100
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High database connections"
      description: "Too many idle connections to database"
```

---

This deployment strategy provides reliable, scalable, and automated delivery of the e-commerce platform using industry best practices for containerization, orchestration, and CI/CD.