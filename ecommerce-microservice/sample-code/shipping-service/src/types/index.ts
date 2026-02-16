export interface ShippingMethod {
  id?: string;
  name: string;
  description?: string;
  carrier?: string;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  cost: number;
  isActive: boolean;
  createdAt?: Date;
}

export interface Shipment {
  id?: string;
  orderId: string;
  shippingMethodId?: string;
  trackingNumber?: string;
  status: ShipmentStatus;
  shippingCost: number;
  weightKg?: number;
  dimensions?: Dimensions;
  originAddress?: Address;
  destinationAddress?: Address;
  shippedAt?: Date;
  deliveredAt?: Date;
  estimatedDelivery?: Date;
  carrierData?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export type ShipmentStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned';

export interface CreateShipmentRequest {
  orderId: string;
  shippingMethodId: string;
  weightKg?: number;
  dimensions?: Dimensions;
  originAddress?: Address;
  destinationAddress: Address;
}

export interface UpdateShipmentStatusRequest {
  status: ShipmentStatus;
  trackingNumber?: string;
  notes?: string;
  location?: string;
}