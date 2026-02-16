import { jest } from '@jest/globals';
import { InventoryService } from '../services/inventoryService';

// Mock dependencies
jest.mock('../models/inventory', () => ({
  InventoryModel: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    findById: jest.fn(),
    findByProduct: jest.fn(),
  })),
}));

jest.mock('../config/kafka', () => ({
  getKafkaProducer: jest.fn(),
}));

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(() => {
    service = new InventoryService();
  });

  it('should create inventory item', async () => {
    const mockModel = require('../models/inventory').InventoryModel.mock.results[0].value;
    mockModel.create.mockResolvedValue({ id: '1', sku: 'TEST-001' });

    const result = await service.createInventory({
      productId: 'prod1',
      sku: 'TEST-001',
      quantityAvailable: 100,
    });

    expect(result.sku).toBe('TEST-001');
    expect(mockModel.create).toHaveBeenCalled();
  });
});