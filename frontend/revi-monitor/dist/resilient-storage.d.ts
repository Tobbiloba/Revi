/**
 * Resilient Storage System with Prioritization and Quota Management
 * Multi-tier storage with intelligent data management
 */
export interface StorageQuota {
    total: number;
    used: number;
    available: number;
    percentage: number;
}
export interface StorageTier {
    name: 'hot' | 'warm' | 'cold';
    maxSize: number;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
    retentionTime: number;
    priority: number;
}
export interface StoredItem<T = any> {
    id: string;
    data: T;
    priority: 'critical' | 'high' | 'medium' | 'low';
    timestamp: number;
    size: number;
    compressed: boolean;
    encrypted: boolean;
    retryCount: number;
    tier: StorageTier['name'];
    expiresAt?: number;
    checksum?: string;
}
export interface StorageStats {
    totalItems: number;
    totalSize: number;
    itemsByPriority: Record<string, number>;
    itemsByTier: Record<string, number>;
    compressionRatio: number;
    oldestItem?: number;
    newestItem?: number;
    quotaUsage: StorageQuota;
}
/**
 * Multi-tier storage with intelligent data management
 */
export declare class ResilientStorage {
    private tiers;
    private indexedDB;
    private localStorage;
    private memoryStore;
    private quotaManager;
    private initialized;
    private compressionWorker;
    constructor();
    private initializeTiers;
    private initializeCompressionWorker;
    initialize(): Promise<void>;
    private initializeIndexedDB;
    private initializeLocalStorage;
    /**
     * Store data with intelligent tier selection
     */
    store<T>(type: 'error' | 'session' | 'network', data: T, options?: {
        priority?: 'critical' | 'high' | 'medium' | 'low';
        ttl?: number;
        forceSync?: boolean;
    }): Promise<string>;
    private storeInTier;
    private storeInMemory;
    private storeInIndexedDB;
    private storeInLocalStorage;
    /**
     * Retrieve data with automatic tier searching
     */
    retrieve<T>(id: string): Promise<StoredItem<T> | null>;
    private retrieveFromTier;
    private retrieveFromIndexedDB;
    private retrieveFromLocalStorage;
    /**
     * Get all items by type with priority ordering
     */
    getAllByType<T>(type: 'error' | 'session' | 'network'): Promise<StoredItem<T>[]>;
    private getAllFromTier;
    private getAllFromIndexedDB;
    private getAllFromLocalStorage;
    /**
     * Remove item from all tiers
     */
    remove(id: string): Promise<void>;
    /**
     * Clear all data
     */
    clear(): Promise<void>;
    private checkQuotaAvailable;
    private makeSpace;
    private cleanupExpiredItems;
    private evictLowPriorityItems;
    private generateId;
    private calculateSize;
    private calculateChecksum;
    private validateItemIntegrity;
    private shouldPromote;
    private promoteItem;
    private encryptData;
    private decryptData;
    private getStoreName;
    private getStoreNameFromId;
    private cleanupIndexedDBStore;
    private cleanupLocalStorage;
    private startBackgroundCleanup;
    /**
     * Store data with resilience features
     */
    storeData(key: string, data: any, options: {
        priority: 'critical' | 'high' | 'medium' | 'low';
        tier?: 'hot' | 'warm' | 'cold';
        compress?: boolean;
        encrypt?: boolean;
    }): Promise<void>;
    /**
     * Get stored data
     */
    getData(key: string): Promise<any>;
    /**
     * Delete stored data
     */
    deleteData(key: string): Promise<void>;
    /**
     * Get all data matching pattern
     */
    getAllDataByPattern(pattern: string): Promise<Array<{
        key: string;
        data: any;
        metadata?: any;
    }>>;
    /**
     * Get storage statistics
     */
    getStats(): Promise<StorageStats>;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ResilientStorageConfig>): void;
    /**
     * Reset statistics
     */
    resetStats(): void;
}
//# sourceMappingURL=resilient-storage.d.ts.map