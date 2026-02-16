import { Kafka, Producer, Consumer } from 'kafkajs';
import logger from '../utils/logger';

let kafka: Kafka;
let producer: Producer;
let consumer: Consumer;

export function getKafkaClient(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: 'order-service',
      brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    });
  }
  return kafka;
}

export async function getKafkaProducer(): Promise<Producer> {
  if (!producer) {
    producer = getKafkaClient().producer();
    await producer.connect();
    logger.info('Kafka producer connected');
  }
  return producer;
}

export async function getKafkaConsumer(): Promise<Consumer> {
  if (!consumer) {
    consumer = getKafkaClient().consumer({ groupId: 'order-service-group' });
    await consumer.connect();
    logger.info('Kafka consumer connected');
  }
  return consumer;
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
  }
  if (consumer) {
    await consumer.disconnect();
  }
}