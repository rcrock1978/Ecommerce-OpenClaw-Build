```

Returns service status and timestamp.

## Testing

### Running Tests

```bash
npm test
```

### Test Coverage

The service includes comprehensive unit tests covering:

- **ShippingService**: Shipment lifecycle, cost calculation, status updates
- **Shipping Methods**: CRUD operations for delivery options
- **Shipment Tracking**: Status updates and history tracking
- **Event Publishing**: Kafka events for shipment updates
- **Error Handling**: Invalid shipments, missing methods
- **Business Logic**: Cost calculation, delivery estimation

### Test Structure

- **Unit Tests**: `src/__tests__/shippingService.test.ts`
- **Mocked Dependencies**: Database models, Kafka producer
- **Integration Points**: Event publishing and external service calls
- **Validation**: Input validation and business rule enforcement
- **State Management**: Shipment status transitions

Tests ensure reliable order fulfillment and tracking.

## Architecture Notes