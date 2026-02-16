import { logger } from '../utils/logger';
import { tracer } from '../utils/tracing';

export interface Event {
  specversion: string;
  type: string;
  source: string;
  id: string;
  time: string;
  correlation_id?: string;
  data: any;
}

export class EventPublisher {
  private kafkaProducer: any; // Would be Kafka producer in real implementation

  constructor() {
    // Initialize Kafka producer here
    // this.kafkaProducer = new KafkaProducer(config.kafka);
  }

  async publish(eventType: string, data: any, correlationId?: string): Promise<void> {
    return tracer.startActiveSpan('EventPublisher.publish', async (span) => {
      span.setAttributes({
        'event.type': eventType,
        'event.correlation_id': correlationId,
      });

      try {
        const event: Event = {
          specversion: '1.0',
          type: `com.ecommerce.product.${eventType}`,
          source: '/product-service',
          id: this.generateEventId(),
          time: new Date().toISOString(),
          correlation_id: correlationId,
          data,
        };

        logger.info('Publishing event', {
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

      } catch (error) {
        span.recordException(error);
        logger.error('Failed to publish event', {
          eventType,
          correlationId,
          error: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}