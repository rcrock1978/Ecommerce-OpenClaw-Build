import { InventoryItem, InventoryMovement, StockAlert } from '../types';
export declare class InventoryModel {
    private pool;
    create(item: InventoryItem): Promise<InventoryItem>;
    findById(id: string): Promise<InventoryItem | null>;
    findByProduct(productId: string, variantId?: string): Promise<InventoryItem | null>;
    findBySku(sku: string): Promise<InventoryItem | null>;
    findLowStock(): Promise<InventoryItem[]>;
    findOutOfStock(): Promise<InventoryItem[]>;
    update(id: string, updates: Partial<InventoryItem>): Promise<void>;
    reserveStock(inventoryId: string, quantity: number, movement: InventoryMovement): Promise<void>;
    releaseStock(inventoryId: string, quantity: number, movement: InventoryMovement): Promise<void>;
    adjustStock(inventoryId: string, quantity: number, movement: InventoryMovement): Promise<void>;
    createAlert(alert: StockAlert): Promise<void>;
    getAlerts(acknowledged?: boolean): Promise<StockAlert[]>;
    acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void>;
}
//# sourceMappingURL=inventory.d.ts.map