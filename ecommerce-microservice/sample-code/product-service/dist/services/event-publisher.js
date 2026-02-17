"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventPublisher = void 0;
const logger_1 = require("../utils/logger");
const tracing_1 = require("../utils/tracing");
class EventPublisher {
    constructor() {
        // Initialize Kafka producer here
        // this.kafkaProducer = new KafkaProducer(config.kafka);
    }
    async publish(eventType, data, correlationId) {
        return tracing_1.tracer.startActiveSpan('EventPublisher.publish', async (span) => {
            span.setAttributes({
                'event.type': eventType,
                'event.correlation_id': correlationId,
            });
            try {
                const event = {
                    specversion: '1.0',
                    type: `com.ecommerce.product.${eventType}`,
                    source: '/product-service',
                    id: this.generateEventId(),
                    time: new Date().toISOString(),
                    correlation_id: correlationId,
                    data,
                };
                logger_1.logger.info('Publishing event', {
                    eventType,
                    eventId: event.id,
                    correlationId
                });
                // In a real implementation, send to Kafka
                // await this.kafkaProducer.send({
                //   topic: 'product-events',
                //   messages: [{ value: JSON.stringify(event) }]
                // });
                // For now, just log the event
                console.log('Event published:', JSON.stringify(event, null, 2));
                span.setAttribute('event.id', event.id);
            }
            catch (error) {
                span.recordException(error);
                logger_1.logger.error('Failed to publish event', {
                    eventType,
                    correlationId,
                    error: error.message
                });
                throw error;
            }
            finally {
                span.end();
            }
        });
    }
    generateEventId() {
        return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.EventPublisher = EventPublisher;
//# sourceMappingURL=event-publisher.js.map