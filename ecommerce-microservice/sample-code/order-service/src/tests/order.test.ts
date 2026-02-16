import { jest } from '@jest/globals';
import { OrderService } from '../services/orderService';
import { OrderModel } from '../models/order';

// Mock dependencies
const mockOrderModel = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  updateStatus: jest.fn(),
  getStatusHistory: jest.fn(),
};

const mockKafkaProducer = {
  send: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('../models/order', () => ({
  OrderModel: jest.fn().mockImplementation(() => mockOrderModel),
}));

jest.mock('../config/kafka', () => ({
  getKafkaProducer: () => Promise.resolve(mockKafkaProducer),
}));

describe('OrderService', () => {
  let orderService: OrderService;

  beforeEach(() => {
    orderService = new OrderService();
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create an order and publish event', async () => {
      const request = {
        userId: 'user1',
        items: [{
          productId: 'prod1',
          quantity: 2,
          unitPrice: 10,
          totalPrice: 20,
        }],
        shippingAddress: {
          street: '123 Main St',
          city: 'City',
          state: 'State',
          zipCode: '12345',
          country: 'Country',
        },
        paymentMethod: {
          type: 'credit_card',
          details: { last4: '1234' },
        },
      };

      const createdOrder = {
        id: 'order1',
        ...request,
        status: 'created',
        totalAmount: 20,
        billingAddress: request.shippingAddress,
      };

      mockOrderModel.create.mockResolvedValue(createdOrder);

      const result = await orderService.createOrder(request);

      expect(mockOrderModel.create).toHaveBeenCalled();
      expect(mockKafkaProducer.send).toHaveBeenCalledWith({
        topic: 'order.created',
        messages: [{ value: JSON.stringify({
          orderId: 'order1',
          userId: 'user1',
          totalAmount: 20,
          items: request.items,
        }) }],
      });
      expect(result).toEqual(createdOrder);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update status and publish events', async () => {
      mockOrderModel.updateStatus.mockResolvedValue(undefined);

      await orderService.updateOrderStatus('order1', 'paid', 'user1', 'Payment received');

      expect(mockOrderModel.updateStatus).toHaveBeenCalledWith('order1', 'paid', 'user1', 'Payment received');
      expect(mockKafkaProducer.send).toHaveBeenCalledWith({
        topic: 'order.status.changed',
        messages: [{ value: expect.any(String) }],
      });
      expect(mockKafkaProducer.send).toHaveBeenCalledWith({
        topic: 'order.paid',
        messages: [{ value: JSON.stringify({ orderId: 'order1' }) }],
      });
    });
  });

  describe('getOrder', () => {
    it('should return order if found', async () => {
      const order = { id: 'order1', userId: 'user1' };
      mockOrderModel.findById.mockResolvedValue(order);

      const result = await orderService.getOrder('order1');

      expect(result).toEqual(order);
      expect(mockOrderModel.findById).toHaveBeenCalledWith('order1');
    });

    it('should return null if not found', async () => {
      mockOrderModel.findById.mockResolvedValue(null);

      const result = await orderService.getOrder('order1');

      expect(result).toBeNull();
    });
  });
});