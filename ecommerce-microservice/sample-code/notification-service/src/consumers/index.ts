import { getKafkaConsumer } from '../config/kafka';
import notificationService from '../services/notificationService';
import logger from '../utils/logger';

export async function startKafkaConsumers(): Promise<void> {
  const consumer = await getKafkaConsumer();

  await consumer.subscribe({ topics: ['order.created', 'order.shipped', 'order.delivered', 'user.password_reset'] });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const data = JSON.parse(message.value?.toString() || '{}');

        switch (topic) {
          case 'order.created':
            await notificationService.handleOrderCreated(data);
            break;
          case 'order.shipped':
            await notificationService.handleOrderShipped(data);
            break;
          case 'order.delivered':
            await notificationService.handleOrderDelivered(data);
            break;
          case 'user.password_reset':
            await notificationService.handlePasswordReset(data);
            break;
          default:
            logger.warn('Unknown topic', { topic });
        }
      } catch (error) {
        logger.error('Error processing Kafka message', { topic, error });
      }
    },
  });

  logger.info('Kafka consumers started');
}