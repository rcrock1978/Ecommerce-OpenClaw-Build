```

Returns service status and timestamp.

## Testing

### Running Tests

```bash
npm test
```

### Test Coverage

The service includes comprehensive unit tests covering:

- **NotificationService**: Send notification logic for email/SMS
- **Event Handlers**: Order lifecycle events (created, shipped, delivered)
- **Error Handling**: Service failures and invalid inputs
- **Kafka Integration**: Event publishing (mocked)
- **API Validation**: Request validation and error responses

### Test Structure

- **Unit Tests**: `src/__tests__/notificationService.test.ts`
- **Mocked Dependencies**: Email service, SMS service, Kafka producer
- **Event Testing**: Kafka event handlers for order notifications
- **Error Scenarios**: Network failures, invalid data

Tests ensure reliable notification delivery and proper error handling.

## Architecture Notes