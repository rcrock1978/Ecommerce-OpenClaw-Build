## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

The service includes comprehensive unit tests covering:

- **ProductService**: CRUD operations, search, caching, event publishing
- **SearchService**: Elasticsearch integration for product search
- **CacheService**: Redis caching operations
- **API Routes**: Endpoint validation and error handling
- **Middleware**: Authentication, rate limiting, validation
- **Models**: Mongoose schema validation and queries

### Test Structure

- **Unit Tests**: `src/__tests__/ProductService.test.ts`
- **Integration Tests**: API endpoint testing with mocked services
- **Setup**: MongoDB Memory Server for isolated database testing

Tests use Jest with:
- Mocked external dependencies (Redis, Elasticsearch, Kafka)
- In-memory MongoDB for database operations
- Supertest for API integration testing
- Coverage thresholds: 80% branches, functions, lines, statements

### Test Categories

- **Happy Path**: Normal operation scenarios
- **Error Handling**: Validation errors, not found cases, conflicts
- **Edge Cases**: Empty results, invalid inputs, concurrent operations
- **Performance**: Caching behavior, query optimization
- **Integration**: Service interactions and event publishing