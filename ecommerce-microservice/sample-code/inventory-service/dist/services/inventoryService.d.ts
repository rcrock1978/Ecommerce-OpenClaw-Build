import { InventoryItem, CreateInventoryRequest, UpdateInventoryRequest, ReserveStockRequest, ReleaseStockRequest } from '../types';
export declare class InventoryService {
    private inventoryModel;
    createInventory(request: CreateInventoryRequest): Promise<InventoryItem>;
    getInventory(id: string): Promise<InventoryItem | null>;
    getInventoryByProduct(productId: string, variantId?: string): Promise<InventoryItem | null>;
    getInventoryBySku(sku: string): Promise<InventoryItem | null>;
    updateInventory(id: string, updates: UpdateInventoryRequest): Promise<void>;
    reserveStock(request: ReserveStockRequest): Promise<void>;
    releaseStock(request: ReleaseStockRequest): Promise<void>;
    getLowStockItems(): Promise<InventoryItem[]>;
    getOutOfStockItems(): Promise<InventoryItem[]>;
    getStockAlerts(): Promise<any[]>;
    acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void>;
    private checkStockAlerts;
    private publishEvent;
}
declare const _default: InventoryService;
export default _default;
//# sourceMappingURL=inventoryService.d.ts.map