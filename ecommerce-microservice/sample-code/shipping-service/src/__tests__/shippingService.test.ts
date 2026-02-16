import { jest } from '@jest/globals';
import { ShippingService } from '../services/shippingService';

// Mock dependencies
jest.mock('../config/kafka', () => ({
  getKafkaProducer: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue(undefined),
  }),
}));

const mockShippingModel = {
  createShippingMethod: jest.fn(),
  getShippingMethods: jest.fn(),
  getShippingMethod: jest.fn(),
  createShipment: jest.fn(),
  getShipment: jest.fn(),
  getShipmentByOrderId: jest.fn(),
  updateShipmentStatus: jest.fn(),
  getShipmentHistory: jest.fn(),
};

jest.mock('../models/shipping', () => ({
  ShippingModel: jest.fn().mockImplementation(() => mockShippingModel),
}));

jest.mock('../utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('ShippingService', () => {
  let shippingService: ShippingService;

  beforeEach(() => {
    shippingService = new ShippingService();
    jest.clearAllMocks();
  });

  describe('createShippingMethod', () => {
    it('should create shipping method successfully', async () => {
      const methodData = {
        name: 'Standard Shipping',
        description: '3-5 business days',
        cost: 5.99,
        estimatedDaysMin: 3,
        estimatedDaysMax: 5,
        isActive: true,
      };

      const createdMethod = {
        id: 'method-id',
        ...methodData,
        createdAt: new Date(),
      };

      mockShippingModel.createShippingMethod.mockResolvedValue(createdMethod);

      const result = await shippingService.createShippingMethod(methodData);

      expect(mockShippingModel.createShippingMethod).toHaveBeenCalledWith(methodData);
      expect(result).toEqual(createdMethod);
    });
  });

  describe('getShippingMethods', () => {
    it('should return all shipping methods', async () => {
      const methods = [
        {
          id: 'method-1',
          name: 'Standard',
          cost: 5.99,
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'method-2',
          name: 'Express',
          cost: 12.99,
          isActive: true,
          createdAt: new Date(),
        },
      ];

      mockShippingModel.getShippingMethods.mockResolvedValue(methods);

      const result = await shippingService.getShippingMethods();

      expect(mockShippingModel.getShippingMethods).toHaveBeenCalled();
      expect(result).toEqual(methods);
    });
  });

  describe('getShippingMethod', () => {
    it('should return shipping method if found', async () => {
      const method = {
        id: 'method-1',
        name: 'Standard',
        cost: 5.99,
        isActive: true,
        createdAt: new Date(),
      };

      mockShippingModel.getShippingMethod.mockResolvedValue(method);

      const result = await shippingService.getShippingMethod('method-1');

      expect(mockShippingModel.getShippingMethod).toHaveBeenCalledWith('method-1');
      expect(result).toEqual(method);
    });

    it('should return null if method not found', async () => {
      mockShippingModel.getShippingMethod.mockResolvedValue(null);

      const result = await shippingService.getShippingMethod('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createShipment', () => {
    it('should create shipment successfully', async () => {
      const request = {
        orderId: 'order-123',
        shippingMethodId: 'method-1',
        weightKg: 2.5,
        dimensions: { length: 30, width: 20, height: 10 },
        originAddress: 'Warehouse A',
        destinationAddress: '123 Main St, City, State',
      };

      const shippingMethod = {
        id: 'method-1',
        name: 'Standard',
        cost: 5.99,
        estimatedDaysMax: 5,
      };

      const createdShipment = {
        id: 'shipment-1',
        orderId: 'order-123',
        shippingMethodId: 'method-1',
        status: 'pending',
        shippingCost: 5.99,
        weightKg: 2.5,
        dimensions: { length: 30, width: 20, height: 10 },
        originAddress: 'Warehouse A',
        destinationAddress: '123 Main St, City, State',
        estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      mockShippingModel.getShippingMethod.mockResolvedValue(shippingMethod);
      mockShippingModel.createShipment.mockResolvedValue(createdShipment);

      const result = await shippingService.createShipment(request);

      expect(mockShippingModel.getShippingMethod).toHaveBeenCalledWith('method-1');
      expect(mockShippingModel.createShipment).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-123',
          shippingMethodId: 'method-1',
          status: 'pending',
          shippingCost: 5.99,
        })
      );
      expect(result).toEqual(createdShipment);
    });

    it('should throw error if shipping method not found', async () => {
      const request = {
        orderId: 'order-123',
        shippingMethodId: 'nonexistent',
        weightKg: 2.5,
        originAddress: 'Warehouse A',
        destinationAddress: '123 Main St, City, State',
      };

      mockShippingModel.getShippingMethod.mockResolvedValue(null);

      await expect(shippingService.createShipment(request)).rejects.toThrow('Shipping method not found');
    });
  });

  describe('getShipment', () => {
    it('should return shipment if found', async () => {
      const shipment = {
        id: 'shipment-1',
        orderId: 'order-123',
        status: 'shipped',
        shippingCost: 5.99,
        createdAt: new Date(),
      };

      mockShippingModel.getShipment.mockResolvedValue(shipment);

      const result = await shippingService.getShipment('shipment-1');

      expect(mockShippingModel.getShipment).toHaveBeenCalledWith('shipment-1');
      expect(result).toEqual(shipment);
    });

    it('should return null if shipment not found', async () => {
      mockShippingModel.getShipment.mockResolvedValue(null);

      const result = await shippingService.getShipment('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getShipmentByOrderId', () => {
    it('should return shipment for order', async () => {
      const shipment = {
        id: 'shipment-1',
        orderId: 'order-123',
        status: 'delivered',
      };

      mockShippingModel.getShipmentByOrderId.mockResolvedValue(shipment);

      const result = await shippingService.getShipmentByOrderId('order-123');

      expect(mockShippingModel.getShipmentByOrderId).toHaveBeenCalledWith('order-123');
      expect(result).toEqual(shipment);
    });
  });

  describe('updateShipmentStatus', () => {
    it('should update shipment status successfully', async () => {
      const existingShipment = {
        id: 'shipment-1',
        orderId: 'order-123',
        status: 'shipped',
      };

      mockShippingModel.getShipment.mockResolvedValue(existingShipment);
      mockShippingModel.updateShipmentStatus.mockResolvedValue(undefined);

      await shippingService.updateShipmentStatus(
        'shipment-1',
        'delivered',
        'TR123456789',
        'Delivered successfully',
        'Customer doorstep'
      );

      expect(mockShippingModel.updateShipmentStatus).toHaveBeenCalledWith(
        'shipment-1',
        'delivered',
        'TR123456789',
        'Delivered successfully',
        'Customer doorstep'
      );
    });

    it('should throw error if shipment not found', async () => {
      mockShippingModel.getShipment.mockResolvedValue(null);

      await expect(shippingService.updateShipmentStatus('nonexistent', 'shipped')).rejects.toThrow('Shipment not found');
    });
  });

  describe('getShipmentHistory', () => {
    it('should return shipment history', async () => {
      const history = [
        {
          id: 'history-1',
          shipmentId: 'shipment-1',
          status: 'pending',
          timestamp: new Date(),
        },
        {
          id: 'history-2',
          shipmentId: 'shipment-1',
          status: 'shipped',
          timestamp: new Date(),
        },
      ];

      mockShippingModel.getShipmentHistory.mockResolvedValue(history);

      const result = await shippingService.getShipmentHistory('shipment-1');

      expect(mockShippingModel.getShipmentHistory).toHaveBeenCalledWith('shipment-1');
      expect(result).toEqual(history);
    });
  });

  describe('calculateShippingCost', () => {
    it('should calculate shipping cost based on weight and destination', async () => {
      // Mock implementation - this would typically involve complex logic
      const result = await shippingService.calculateShippingCost(2.5, 'US');

      // Since it's a simple implementation, it might return a fixed value or calculation
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});