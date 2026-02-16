Returns service status and timestamp.

## Testing

### Running Tests

```bash
npm test
```

### Test Coverage

The service includes comprehensive unit tests covering:

- **ReviewService**: CRUD operations, rating calculations, moderation
- **Review Model**: MongoDB operations with Mongoose
- **Validation**: Input validation and business rules
- **Rating Summaries**: Statistical calculations and distributions
- **Moderation**: Approve/reject workflow
- **Edge Cases**: Duplicate reviews, unauthorized updates

### Test Structure

- **Unit Tests**: `src/__tests__/reviewService.test.ts`
- **Database Tests**: MongoDB Memory Server for isolated testing
- **Mock Setup**: Clean database state between tests
- **Business Logic**: Verified reviews, moderation workflow
- **Performance**: Query optimization and aggregation testing

Tests ensure data integrity and proper review management.

## Architecture Notes