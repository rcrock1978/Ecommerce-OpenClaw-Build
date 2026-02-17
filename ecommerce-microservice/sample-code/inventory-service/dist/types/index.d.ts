export interface InventoryItem {
    id?: string;
    productId: string;
    variantId?: string;
    sku: string;
    quantityAvailable: number;
    quantityReserved: number;
    lowStockThreshold: number;
    location?: string;
    lastUpdated?: Date;
    createdAt?: Date;
}
export interface InventoryMovement {
    id?: string;
    inventoryId: string;
    movementType: 'stock_in' | 'stock_out' | 'reservation' | 'release';
    quantity: number;
    referenceId?: string;
    referenceType?: 'order' | 'shipment' | 'adjustment';
    notes?: string;
    createdBy?: string;
    createdAt?: Date;
}
export interface StockAlert {
    id?: string;
    inventoryId: string;
    alertType: 'low_stock' | 'out_of_stock' | 'overstock';
    message: string;
    acknowledged: boolean;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
    createdAt?: Date;
}
export interface CreateInventoryRequest {
    productId: string;
    variantId?: string;
    sku: string;
    quantityAvailable: number;
    lowStockThreshold?: number;
    location?: string;
}
export interface UpdateInventoryRequest {
    quantityAvailable?: number;
    lowStockThreshold?: number;
    location?: string;
}
export interface ReserveStockRequest {
    productId: string;
    variantId?: string;
    quantity: number;
    referenceId?: string;
    referenceType?: 'order' | 'shipment';
    notes?: string;
}
export interface ReleaseStockRequest {
    productId: string;
    variantId?: string;
    quantity: number;
    referenceId?: string;
    referenceType?: 'order' | 'shipment';
    notes?: string;
}
//# sourceMappingURL=index.d.ts.map