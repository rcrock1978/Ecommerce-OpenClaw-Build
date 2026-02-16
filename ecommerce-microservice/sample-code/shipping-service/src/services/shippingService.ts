import { getKafkaProducer } from '../config/kafka';
import { ShippingModel } from '../models/shipping';
import { ShippingMethod, Shipment, CreateShipmentRequest, ShipmentStatus } from '../types';
import logger from '../utils/logger';

export class ShippingService {
  private shippingModel = new ShippingModel();

  async createShippingMethod(method: Omit<ShippingMethod, 'id' | 'createdAt'>): Promise<ShippingMethod> {
    return this.shippingModel.createShippingMethod(method);
  }

  async getShippingMethods(): Promise<ShippingMethod[]> {
    return this.shippingModel.getShippingMethods();
  }

  async getShippingMethod(id: string): Promise<ShippingMethod | null> {
    return this.shippingModel.getShippingMethod(id);
  }

  async createShipment(request: CreateShipmentRequest): Promise<Shipment> {
    const shippingMethod = await this.shippingModel.getShippingMethod(request.shippingMethodId);
    if (!shippingMethod) {
      throw new Error('Shipping method not found');
    }

    // Calculate shipping cost if not provided
    const shippingCost = shippingMethod.cost;

    // Calculate estimated delivery
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + (shippingMethod.estimatedDaysMax || 7));

    const shipment: Shipment = {
      orderId: request.orderId,
      shippingMethodId: request.shippingMethodId,
      status: 'pending',
      shippingCost,
      weightKg: request.weightKg,
      dimensions: request.dimensions,
      originAddress: request.originAddress,
      destinationAddress: request.destinationAddress,
      estimatedDelivery,
    };

    const created = await this.shippingModel.createShipment(shipment);

    // Publish event
    await this.publishEvent('shipment.created', {
      shipmentId: created.id,
      orderId: request.orderId,
      shippingCost,
      estimatedDelivery: created.estimatedDelivery,
    });

    return created;
  }

  async getShipment(id: string): Promise<Shipment | null> {
    return this.shippingModel.getShipment(id);
  }

  async getShipmentByOrderId(orderId: string): Promise<Shipment | null> {
    return this.shippingModel.getShipmentByOrderId(orderId);
  }

  async updateShipmentStatus(id: string, status: ShipmentStatus, trackingNumber?: string, notes?: string, location?: string): Promise<void> {
    await this.shippingModel.updateShipmentStatus(id, status, trackingNumber, notes, location);

    // Publish status change event
    await this.publishEvent('shipment.status.changed', {
      shipmentId: id,
      status,
      trackingNumber,
      notes,
      location,
      changedAt: new Date(),
    });

    // Publish specific events
    if (status === 'shipped') {
      await this.publishEvent('shipment.shipped', { shipmentId: id, trackingNumber });
    } else if (status === 'delivered') {
      await this.publishEvent('shipment.delivered', { shipmentId: id });
    }
  }

  async getShipmentHistory(shipmentId: string): Promise<any[]> {
    return this.shippingModel.getShipmentHistory(shipmentId);
  }

  async calculateShippingCost(weightKg: number, destination: string): Promise<number> {
    return this.shippingModel.calculateShippingCost(weightKg, destination);
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
    }
  }
}

export default new ShippingService();