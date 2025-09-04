/**
 * Intelligent Sync-on-Reconnect System
 * Handles efficient data synchronization when network connectivity is restored
 */
import { ResilientStorage, StoredItem } from './resilient-storage';
import { EndpointHealthMonitor } from './health-monitor';
export interface SyncProgress {
    phase: 'preparing' | 'syncing' | 'completed' | 'failed';
    totalItems: number;
    syncedItems: number;
    failedItems: number;
    currentBatch: number;
    totalBatches: number;
    estimatedTimeRemaining: number;
    bytesTransferred: number;
    totalBytes: number;
    errors: string[];
}
export interface SyncConfig {
    batchSize: number;
    maxConcurrentBatches: number;
    priorityWeights: Record<string, number>;
    bandwidthThrottling: boolean;
    progressiveSync: boolean;
    conflictResolution: 'client-wins' | 'server-wins' | 'timestamp-wins';
    maxSyncTime: number;
    resumeIncomplete: boolean;
}
export interface SyncContext {
    sessionId: string;
    userId?: string;
    deviceId: string;
    lastSyncTimestamp: number;
    offlineDuration: number;
    networkQuality: 'excellent' | 'good' | 'poor' | 'unknown';
    batteryLevel?: number;
    isBackground?: boolean;
}
export interface ConflictItem {
    localItem: StoredItem;
    serverItem?: any;
    conflictType: 'timestamp' | 'version' | 'data';
    resolution: 'pending' | 'resolved';
    resolvedWith: 'local' | 'server' | 'merged';
}
/**
 * Intelligent Sync Manager
 */
export declare class IntelligentSyncManager {
    private storage;
    private retryManager;
    private healthMonitor;
    private currentSync;
    private syncContext;
    private config;
    private listeners;
    private abortController;
    private syncHistory;
    constructor(storage: ResilientStorage, config?: Partial<SyncConfig>);
    /**
     * Initialize sync manager with health monitoring
     */
    initialize(apiEndpoint: string, healthMonitor?: EndpointHealthMonitor): void;
    private setupNetworkListeners;
    private handleNetworkReconnection;
    /**
     * Start intelligent synchronization
     */
    startIntelligentSync(context?: Partial<SyncContext>): Promise<SyncProgress>;
    private performIntelligentSync;
    private prepareSyncPlan;
    private calculateAdaptiveBatchSize;
    private createIntelligentBatches;
    private executeSyncBatches;
    private syncBatch;
    private syncErrorItems;
    private syncSessionItems;
    private syncNetworkItems;
    private detectConflicts;
    private resolveConflicts;
    private updateEstimatedTime;
    /**
     * Cancel current sync operation
     */
    cancelSync(): void;
    /**
     * Get sync progress if sync is running
     */
    getCurrentProgress(): SyncProgress | null;
    /**
     * Check if sync is currently running
     */
    isSyncRunning(): boolean;
    /**
     * Listen for sync progress updates
     */
    onProgress(callback: (progress: SyncProgress) => void): () => void;
    private notifyProgress;
    private generateSessionId;
    private getDeviceId;
    private getLastSyncTimestamp;
    private updateLastSyncTimestamp;
    private assessNetworkQuality;
    private getBatteryLevel;
    private recordSyncHistory;
    private isPromisePending;
    private sleep;
    /**
     * Get sync history
     */
    getSyncHistory(): typeof this.syncHistory;
    /**
     * Update sync configuration
     */
    updateConfig(newConfig: Partial<SyncConfig>): void;
    /**
     * Get current sync configuration
     */
    getConfig(): SyncConfig;
    /**
     * Get statistics
     */
    getStats(): any;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Destroy and cleanup
     */
    destroy(): void;
}
//# sourceMappingURL=sync-manager.d.ts.map