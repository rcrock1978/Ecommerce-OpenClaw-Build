import { getKafkaProducer } from '../config/kafka';
import { OrderModel } from '../models/order';
import { Order, CreateOrderRequest, OrderStatus } from '../types';
import logger from '../utils/logger';

export class OrderService {
  private orderModel = new OrderModel();

  async createOrder(request: CreateOrderRequest): Promise<Order> {
    // Calculate total amount
    const totalAmount = request.items.reduce((sum, item) => sum + item.totalPrice, 0);

    const order: Order = {
      userId: request.userId,
      status: 'created',
      totalAmount,
      items: request.items,
      shippingAddress: request.shippingAddress,
      billingAddress: request.billingAddress || request.shippingAddress,
      paymentMethod: request.paymentMethod,
    };

    const createdOrder = await this.orderModel.create(order);

    // Publish order created event
    await this.publishEvent('order.created', {
      orderId: createdOrder.id,
      userId: request.userId,
      totalAmount,
      items: request.items,
    });

    logger.info('Order created successfully', { orderId: createdOrder.id });
    return createdOrder;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orderModel.findById(orderId);
  }

  async getUserOrders(userId: string, limit = 50, offset = 0): Promise<Order[]> {
    return this.orderModel.findByUserId(userId, limit, offset);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, changedBy?: string, notes?: string): Promise<void> {
    await this.orderModel.updateStatus(orderId, status, changedBy, notes);

    // Publish status change event
    await this.publishEvent('order.status.changed', {
      orderId,
      status,
      changedBy,
      notes,
      changedAt: new Date(),
    });

    // Publish specific events based on status
    switch (status) {
      case 'paid':
        await this.publishEvent('order.paid', { orderId });
        break;
      case 'shipped':
        await this.publishEvent('order.shipped', { orderId });
        break;
      case 'delivered':
        await this.publishEvent('order.delivered', { orderId });
        break;
      case 'cancelled':
        await this.publishEvent('order.cancelled', { orderId });
        break;
    }
  }

  async getOrderHistory(orderId: string): Promise<any[]> {
    return this.orderModel.getStatusHistory(orderId);
  }

  private async publishEvent(topic: string, data: any): Promise<void> {
    try {
      const producer = await getKafkaProducer();
      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(data) }],
      });
      logger.debug('Event published', { topic, data });
    } catch (error) {
      logger.error('Failed to publish event', { topic, error });
      // Don't throw - event publishing failure shouldn't break order operations
    }
  }
}

export default new OrderService();