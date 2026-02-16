# 🛒 NexaCommerce — E-Commerce Microservice Platform

> A production-grade, event-driven e-commerce platform built on microservice architecture.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-1.22-00ADD8)](https://go.dev/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.29-326CE5)](https://kubernetes.io/)

---

## Overview

NexaCommerce is a fully decomposed e-commerce platform comprising **10 independently deployable microservices**, communicating via **Apache Kafka** for asynchronous event-driven workflows and **REST APIs** for synchronous operations. The system is designed for **horizontal scalability**, **fault tolerance**, and **rapid feature development** by autonomous teams.

### Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Primary Language | TypeScript (Node.js) | Developer velocity, rich ecosystem, shared types with frontend |
| Performance-Critical Services | Go | Raw throughput for payment & order processing; sub-ms GC pauses |
| Frontend | Next.js 14 (App Router) | Server Components for SEO, streaming SSR, React ecosystem |
| Inter-Service Comms | Kafka + REST | Kafka for eventual consistency & decoupling; REST for queries |
| Data Strategy | Polyglot persistence | Right database for the right job (PostgreSQL, Redis, MongoDB) |
| Orchestration | Kubernetes | Industry standard, auto-scaling, self-healing, declarative |
| API Gateway | Kong | Plugin ecosystem, rate limiting, auth offloading, observability |

### Architecture at a Glance

```
                         ┌─────────────┐
                         │   Clients   │
                         │ Web / Mobile │
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │ Kong Gateway│
                         │  (API GW)   │
                         └──────┬──────┘
                                │
          ┌─────────┬───────┬───┴───┬────────┬──────────┐
          ▼         ▼       ▼       ▼        ▼          ▼
     ┌────────┐┌────────┐┌─────┐┌───────┐┌────────┐┌────────┐
     │ User   ││Product ││Cart ││ Order ││Payment ││  ...   │
     │Service ││Service ││Svc  ││Service││Service ││        │
     └───┬────┘└───┬────┘└──┬──┘└───┬───┘└───┬────┘└────────┘
         │         │        │       │        │
         └─────────┴────────┴───┬───┴────────┘
                                │
                         ┌──────▼──────┐
                         │ Apache Kafka│
                         │ Event Bus   │
                         └─────────────┘
```

## Services

| Service | Language | Database | Port | Description |
|---|---|---|---|---|
| **User Service** | TypeScript | PostgreSQL | 3001 | Auth, profiles, addresses |
| **Product Service** | TypeScript | MongoDB + ES | 3002 | Catalog, categories, search |
| **Cart Service** | TypeScript | Redis | 3003 | Cart management |
| **Order Service** | Go | PostgreSQL | 3004 | Order lifecycle, state machine |
| **Payment Service** | Go | PostgreSQL | 3005 | Stripe/PayPal, refunds |
| **Inventory Service** | TypeScript | PostgreSQL | 3006 | Stock, reservations |
| **Notification Service** | TypeScript | PostgreSQL | 3007 | Email, SMS, push |
| **Review Service** | TypeScript | MongoDB | 3008 | Ratings, reviews |
| **Shipping Service** | TypeScript | PostgreSQL | 3009 | Tracking, carriers |
| **API Gateway** | Kong | — | 8000 | Routing, rate limiting, auth |

## Quick Start

### Prerequisites

- Docker & Docker Compose v2
- Node.js 20+ (for local service dev)
- Go 1.22+ (for payment/order service dev)
- Make

### Run Everything Locally

```bash
# Clone the repository
git clone https://github.com/your-org/nexacommerce.git
cd nexacommerce

# Start all infrastructure + services
docker compose up -d

# Verify all services are healthy
docker compose ps

# Seed sample data
make seed

# Open the storefront
open http://localhost:3000

# Kong Admin API
open http://localhost:8001
```

### Run a Single Service (Development)

```bash
cd services/user-service
cp .env.example .env
npm install
npm run dev   # Runs with ts-node-dev, hot reload
```

### Run Tests

```bash
# All tests across all services
make test

# Single service
cd services/user-service
npm test              # Unit tests
npm run test:int      # Integration tests (needs Docker)
npm run test:e2e      # E2E tests
```

## Documentation

| Document | Description |
|---|---|
| [Architecture Overview](docs/01-architecture-overview.md) | High-level design, DDD, CQRS |
| [Tech Stack](docs/02-tech-stack.md) | Complete stack with justifications |
| [Microservices Design](docs/03-microservices-design.md) | Per-service detailed design |
| [Database Design](docs/04-database-design.md) | Schemas, ER diagrams, migrations |
| [API Design](docs/05-api-design.md) | Full REST API specifications |
| [Event-Driven Architecture](docs/06-event-driven-architecture.md) | Kafka, sagas, event schemas |
| [Security](docs/07-security.md) | Auth, RBAC, OWASP mitigations |
| [Testing Strategy](docs/08-testing-strategy.md) | Test plan, sample code |
| [Deployment](docs/09-deployment.md) | Docker, K8s, CI/CD, Helm |
| [Monitoring & Observability](docs/10-monitoring-observability.md) | Logging, metrics, tracing |
| [Project Roadmap](docs/11-project-roadmap.md) | Phased implementation plan |

## Project Structure

```
nexacommerce/
├── services/
│   ├── user-service/          # TypeScript
│   ├── product-service/       # TypeScript
│   ├── cart-service/          # TypeScript
│   ├── order-service/         # Go
│   ├── payment-service/       # Go
│   ├── inventory-service/     # TypeScript
│   ├── notification-service/  # TypeScript
│   ├── review-service/        # TypeScript
│   └── shipping-service/      # TypeScript
├── frontend/                  # Next.js 14
├── infrastructure/
│   ├── k8s/                   # Kubernetes manifests
│   ├── helm/                  # Helm charts
│   ├── terraform/             # Cloud provisioning
│   └── monitoring/            # Prometheus, Grafana configs
├── proto/                     # Shared event schemas (Avro/JSON Schema)
├── docs/                      # Architecture documentation
├── docker-compose.yml         # Local development
└── Makefile                   # Project-wide commands
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines, commit conventions, and PR process.

## License

MIT © NexaCommerce
