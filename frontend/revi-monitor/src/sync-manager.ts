/**
 * Intelligent Sync-on-Reconnect System
 * Handles efficient data synchronization when network connectivity is restored
 */

import { ResilientStorage, StoredItem } from './resilient-storage';
import { RetryManager } from './retry-manager';
import { EndpointHealthMonitor } from './health-monitor';
import { ErrorEvent, SessionEvent, NetworkEvent } from './types';

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
export class IntelligentSyncManager {
  private storage: ResilientStorage;
  private retryManager: RetryManager;
  private healthMonitor: EndpointHealthMonitor | null = null;
  private currentSync: Promise<SyncProgress> | null = null;
  private syncContext: SyncContext | null = null;
  private config: SyncConfig;
  private listeners: Array<(progress: SyncProgress) => void> = [];
  private abortController: AbortController | null = null;
  private syncHistory: Array<{ timestamp: number; duration: number; itemsSynced: number; success: boolean }> = [];

  constructor(
    storage: ResilientStorage,
    config: Partial<SyncConfig> = {}
  ) {
    this.storage = storage;
    this.retryManager = new RetryManager({
      maxAttempts: 5,
      baseDelay: 2000,
      maxDelay: 30000,
      enableJitter: true
    });

    this.config = {
      batchSize: 20,
      maxConcurrentBatches: 3,
      priorityWeights: {
        critical: 1.0,
        high: 0.8,
        medium: 0.5,
        low: 0.2
      },
      bandwidthThrottling: true,
      progressiveSync: true,
      conflictResolution: 'timestamp-wins',
      maxSyncTime: 300000, // 5 minutes
      resumeIncomplete: true,
      ...config
    };
  }

  /**
   * Initialize sync manager with health monitoring
   */
  initialize(apiEndpoint: string, healthMonitor?: EndpointHealthMonitor): void {
    if (healthMonitor) {
      this.healthMonitor = healthMonitor;
    } else {
      this.healthMonitor = new EndpointHealthMonitor('sync-health', {
        endpoint: `${apiEndpoint}/health`,
        interval: 30000,
        timeout: 10000
      });
      this.healthMonitor.start();
    }

    // Listen for network reconnection
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.handleNetworkReconnection();
    });

    // Listen for visibility changes (tab becomes active)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.onLine) {
        this.handleNetworkReconnection();
      }
    });
  }

  private async handleNetworkReconnection(): Promise<void> {
    // Wait a bit for connection to stabilize
    await this.sleep(2000);
    
    // Check if we actually have connectivity
    if (this.healthMonitor) {
      const health = await this.healthMonitor.forceCheck();
      if (health.status === 'unhealthy') {
        console.log('[SyncManager] API still unhealthy after reconnection, waiting...');
        return;
      }
    }

    // Start sync if not already running
    if (!this.currentSync) {
      this.startIntelligentSync();
    }
  }

  /**
   * Start intelligent synchronization
   */
  async startIntelligentSync(context?: Partial<SyncContext>): Promise<SyncProgress> {
    // Return existing sync if in progress
    if (this.currentSync) {
      return this.currentSync;
    }

    // Create sync context
    this.syncContext = {
      sessionId: this.generateSessionId(),
      deviceId: this.getDeviceId(),
      lastSyncTimestamp: this.getLastSyncTimestamp(),
      offlineDuration: Date.now() - this.getLastSyncTimestamp(),
      networkQuality: await this.assessNetworkQuality(),
      batteryLevel: this.getBatteryLevel(),
      isBackground: document.hidden,
      ...context
    };

    // Create abort controller for cancellation
    this.abortController = new AbortController();

    // Start sync process
    this.currentSync = this.performIntelligentSync(this.syncContext);
    
    try {
      const result = await this.currentSync;
      this.recordSyncHistory(result);
      return result;
    } finally {
      this.currentSync = null;
      this.syncContext = null;
      this.abortController = null;
    }
  }

  private async performIntelligentSync(context: SyncContext): Promise<SyncProgress> {
    const progress: SyncProgress = {
      phase: 'preparing',
      totalItems: 0,
      syncedItems: 0,
      failedItems: 0,
      currentBatch: 0,
      totalBatches: 0,
      estimatedTimeRemaining: 0,
      bytesTransferred: 0,
      totalBytes: 0,
      errors: []
    };

    this.notifyProgress(progress);

    try {
      // Phase 1: Prepare sync data
      const syncPlan = await this.prepareSyncPlan(context);
      progress.totalItems = syncPlan.totalItems;
      progress.totalBatches = syncPlan.batches.length;
      progress.totalBytes = syncPlan.totalBytes;

      // Phase 2: Execute sync with intelligent batching
      progress.phase = 'syncing';
      this.notifyProgress(progress);

      const startTime = Date.now();
      await this.executeSyncBatches(syncPlan, progress);

      // Phase 3: Handle conflicts and finalize
      if (syncPlan.conflicts.length > 0) {
        await this.resolveConflicts(syncPlan.conflicts);
      }

      progress.phase = 'completed';
      progress.estimatedTimeRemaining = 0;
      this.notifyProgress(progress);

      // Update last sync timestamp
      this.updateLastSyncTimestamp();

      return progress;

    } catch (error: any) {
      progress.phase = 'failed';
      progress.errors.push(error.message);
      this.notifyProgress(progress);
      throw error;
    }
  }

  private async prepareSyncPlan(context: SyncContext): Promise<{
    batches: Array<{ items: StoredItem[]; priority: number; estimatedBytes: number }>;
    totalItems: number;
    totalBytes: number;
    conflicts: ConflictItem[];
  }> {
    // Get all items that need syncing
    const [errors, sessions, networkEvents] = await Promise.all([
      this.storage.getAllByType<ErrorEvent>('error'),
      this.storage.getAllByType<SessionEvent>('session'),
      this.storage.getAllByType<NetworkEvent>('network')
    ]);

    const allItems = [...errors, ...sessions, ...networkEvents];
    
    // Filter items that need syncing (newer than last sync)
    const itemsToSync = allItems.filter(item => 
      item.timestamp > context.lastSyncTimestamp
    );

    // Sort by priority and timestamp
    itemsToSync.sort((a, b) => {
      const priorityWeight = this.config.priorityWeights[a.priority] - this.config.priorityWeights[b.priority];
      if (priorityWeight !== 0) return -priorityWeight; // Higher priority first
      return a.timestamp - b.timestamp; // Older first within same priority
    });

    // Adapt batch size based on network quality and context
    const adaptedBatchSize = this.calculateAdaptiveBatchSize(context);

    // Create intelligent batches
    const batches = this.createIntelligentBatches(itemsToSync, adaptedBatchSize);

    // Check for potential conflicts (simplified implementation)
    const conflicts = await this.detectConflicts(itemsToSync);

    const totalBytes = itemsToSync.reduce((sum, item) => sum + item.size, 0);

    return {
      batches,
      totalItems: itemsToSync.length,
      totalBytes,
      conflicts
    };
  }

  private calculateAdaptiveBatchSize(context: SyncContext): number {
    let adaptedSize = this.config.batchSize;

    // Adjust based on network quality
    switch (context.networkQuality) {
      case 'poor':
        adaptedSize = Math.max(5, adaptedSize * 0.3);
        break;
      case 'good':
        adaptedSize = Math.floor(adaptedSize * 0.8);
        break;
      case 'excellent':
        adaptedSize = Math.floor(adaptedSize * 1.5);
        break;
    }

    // Adjust based on battery level
    if (context.batteryLevel && context.batteryLevel < 0.2) {
      adaptedSize = Math.max(3, adaptedSize * 0.5);
    }

    // Adjust based on background status
    if (context.isBackground) {
      adaptedSize = Math.max(5, adaptedSize * 0.6);
    }

    // Adjust based on offline duration
    if (context.offlineDuration > 3600000) { // More than 1 hour
      adaptedSize = Math.max(10, adaptedSize * 0.7); // Smaller batches for large backlogs
    }

    return Math.floor(adaptedSize);
  }

  private createIntelligentBatches(
    items: StoredItem[],
    batchSize: number
  ): Array<{ items: StoredItem[]; priority: number; estimatedBytes: number }> {
    const batches: Array<{ items: StoredItem[]; priority: number; estimatedBytes: number }> = [];
    
    // Group by priority first
    const priorityGroups = new Map<string, StoredItem[]>();
    items.forEach(item => {
      if (!priorityGroups.has(item.priority)) {
        priorityGroups.set(item.priority, []);
      }
      priorityGroups.get(item.priority)!.push(item);
    });

    // Create batches within each priority group
    const priorities = ['critical', 'high', 'medium', 'low'];
    priorities.forEach(priority => {
      const groupItems = priorityGroups.get(priority) || [];
      
      for (let i = 0; i < groupItems.length; i += batchSize) {
        const batchItems = groupItems.slice(i, i + batchSize);
        const estimatedBytes = batchItems.reduce((sum, item) => sum + item.size, 0);
        
        batches.push({
          items: batchItems,
          priority: this.config.priorityWeights[priority],
          estimatedBytes
        });
      }
    });

    return batches;
  }

  private async executeSyncBatches(
    syncPlan: ReturnType<IntelligentSyncManager['prepareSyncPlan']> extends Promise<infer T> ? T : never,
    progress: SyncProgress
  ): Promise<void> {
    const concurrentBatches: Promise<void>[] = [];
    let activeBatches = 0;

    for (let i = 0; i < syncPlan.batches.length; i++) {
      const batch = syncPlan.batches[i];
      
      // Wait if we've hit the concurrency limit
      while (activeBatches >= this.config.maxConcurrentBatches) {
        await Promise.race(concurrentBatches);
        activeBatches = concurrentBatches.filter(p => this.isPromisePending(p)).length;
      }

      // Check if sync was aborted
      if (this.abortController?.signal.aborted) {
        throw new Error('Sync aborted');
      }

      // Execute batch
      const batchPromise = this.syncBatch(batch, i + 1, progress);
      concurrentBatches.push(batchPromise);
      activeBatches++;

      // Update progress
      progress.currentBatch = i + 1;
      this.updateEstimatedTime(progress, syncPlan);
      this.notifyProgress(progress);

      // Add progressive delay for bandwidth throttling
      if (this.config.bandwidthThrottling && this.syncContext?.networkQuality === 'poor') {
        await this.sleep(1000 * (i % 3)); // 0, 1, 2 second delays
      }
    }

    // Wait for all batches to complete
    await Promise.allSettled(concurrentBatches);
  }

  private async syncBatch(
    batch: { items: StoredItem[]; priority: number; estimatedBytes: number },
    batchNumber: number,
    progress: SyncProgress
  ): Promise<void> {
    try {
      // Group items by type for efficient API calls
      const errorItems = batch.items.filter(item => item.id.startsWith('error_'));
      const sessionItems = batch.items.filter(item => item.id.startsWith('session_'));
      const networkItems = batch.items.filter(item => item.id.startsWith('network_'));

      // Sync each type with appropriate retry strategies
      await Promise.all([
        errorItems.length > 0 ? this.syncErrorItems(errorItems) : Promise.resolve(),
        sessionItems.length > 0 ? this.syncSessionItems(sessionItems) : Promise.resolve(),
        networkItems.length > 0 ? this.syncNetworkItems(networkItems) : Promise.resolve()
      ]);

      // Update progress
      progress.syncedItems += batch.items.length;
      progress.bytesTransferred += batch.estimatedBytes;

      // Remove synced items from storage
      await Promise.all(
        batch.items.map(item => this.storage.remove(item.id))
      );

    } catch (error: any) {
      progress.failedItems += batch.items.length;
      progress.errors.push(`Batch ${batchNumber} failed: ${error.message}`);
      
      // Don't remove failed items - they'll be retried later
      console.error(`[SyncManager] Batch ${batchNumber} sync failed:`, error);
    }
  }

  private async syncErrorItems(items: StoredItem<ErrorEvent>[]): Promise<void> {
    const payload = {
      errors: items.map(item => ({
        ...item.data,
        client_timestamp: item.timestamp,
        retry_count: item.retryCount,
        offline_duration: this.syncContext?.offlineDuration || 0
      }))
    };

    return this.retryManager.executeWithRetry(
      'sync-errors',
      async () => {
        const response = await fetch('/api/capture/error', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sync-Session': this.syncContext?.sessionId || ''
          },
          body: JSON.stringify(payload),
          signal: this.abortController?.signal
        });

        if (!response.ok) {
          throw new Error(`Error sync failed: ${response.status}`);
        }

        return response.json();
      },
      {
        priority: 'high',
        payloadSize: JSON.stringify(payload).length,
        deduplicationKey: `errors-${items.map(i => i.id).join('-')}`
      }
    );
  }

  private async syncSessionItems(items: StoredItem<SessionEvent>[]): Promise<void> {
    // Group by session ID for more efficient syncing
    const sessionGroups = new Map<string, StoredItem<SessionEvent>[]>();
    items.forEach(item => {
      const sessionId = item.data.sessionId;
      if (!sessionGroups.has(sessionId)) {
        sessionGroups.set(sessionId, []);
      }
      sessionGroups.get(sessionId)!.push(item);
    });

    // Sync each session group
    for (const [sessionId, sessionItems] of sessionGroups) {
      const payload = {
        session_id: sessionId,
        events: sessionItems.map(item => ({
          ...item.data,
          client_timestamp: item.timestamp,
          retry_count: item.retryCount
        }))
      };

      await this.retryManager.executeWithRetry(
        `sync-session-${sessionId}`,
        async () => {
          const response = await fetch('/api/capture/session-event', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Sync-Session': this.syncContext?.sessionId || ''
            },
            body: JSON.stringify(payload),
            signal: this.abortController?.signal
          });

          if (!response.ok) {
            throw new Error(`Session sync failed: ${response.status}`);
          }

          return response.json();
        },
        {
          priority: 'medium',
          payloadSize: JSON.stringify(payload).length,
          deduplicationKey: `session-${sessionId}`
        }
      );
    }
  }

  private async syncNetworkItems(items: StoredItem<NetworkEvent>[]): Promise<void> {
    const payload = {
      events: items.map(item => ({
        ...item.data,
        client_timestamp: item.timestamp,
        retry_count: item.retryCount
      }))
    };

    return this.retryManager.executeWithRetry(
      'sync-network',
      async () => {
        const response = await fetch('/api/capture/network-event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sync-Session': this.syncContext?.sessionId || ''
          },
          body: JSON.stringify(payload),
          signal: this.abortController?.signal
        });

        if (!response.ok) {
          throw new Error(`Network sync failed: ${response.status}`);
        }

        return response.json();
      },
      {
        priority: 'low',
        payloadSize: JSON.stringify(payload).length,
        deduplicationKey: `network-${items.length}`
      }
    );
  }

  private async detectConflicts(items: StoredItem[]): Promise<ConflictItem[]> {
    // Simplified conflict detection - in practice, this would check against server state
    const conflicts: ConflictItem[] = [];
    
    // For demo purposes, assume some items might conflict
    items.forEach(item => {
      if (item.retryCount > 3) { // Items that have failed multiple times might conflict
        conflicts.push({
          localItem: item,
          conflictType: 'timestamp',
          resolution: 'pending',
          resolvedWith: 'local'
        });
      }
    });

    return conflicts;
  }

  private async resolveConflicts(conflicts: ConflictItem[]): Promise<void> {
    for (const conflict of conflicts) {
      switch (this.config.conflictResolution) {
        case 'client-wins':
          conflict.resolvedWith = 'local';
          break;
        case 'server-wins':
          conflict.resolvedWith = 'server';
          break;
        case 'timestamp-wins':
          // Use timestamp to determine winner
          conflict.resolvedWith = 'local'; // Simplified
          break;
      }
      conflict.resolution = 'resolved';
    }
  }

  private updateEstimatedTime(progress: SyncProgress, syncPlan: any): void {
    if (progress.syncedItems > 0) {
      const elapsedTime = Date.now() - (this.syncContext?.lastSyncTimestamp || Date.now());
      const timePerItem = elapsedTime / progress.syncedItems;
      const remainingItems = progress.totalItems - progress.syncedItems;
      progress.estimatedTimeRemaining = Math.floor(remainingItems * timePerItem);
    }
  }

  /**
   * Cancel current sync operation
   */
  cancelSync(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Get sync progress if sync is running
   */
  getCurrentProgress(): SyncProgress | null {
    return this.currentSync ? null : null; // Would need to track progress state
  }

  /**
   * Check if sync is currently running
   */
  isSyncRunning(): boolean {
    return this.currentSync !== null;
  }

  /**
   * Listen for sync progress updates
   */
  onProgress(callback: (progress: SyncProgress) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyProgress(progress: SyncProgress): void {
    this.listeners.forEach(callback => {
      try {
        callback({ ...progress });
      } catch (error) {
        console.error('Sync progress listener error:', error);
      }
    });
  }

  // Helper methods
  private generateSessionId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceId(): string {
    // Simple device ID generation - in practice, use more sophisticated approach
    let deviceId = localStorage.getItem('revi_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('revi_device_id', deviceId);
    }
    return deviceId;
  }

  private getLastSyncTimestamp(): number {
    const stored = localStorage.getItem('revi_last_sync');
    return stored ? parseInt(stored) : 0;
  }

  private updateLastSyncTimestamp(): void {
    localStorage.setItem('revi_last_sync', Date.now().toString());
  }

  private async assessNetworkQuality(): Promise<'excellent' | 'good' | 'poor' | 'unknown'> {
    if (!this.healthMonitor) return 'unknown';
    
    const health = this.healthMonitor.getHealthStatus();
    
    if (health.responseTime && health.responseTime < 1000 && health.metrics.successRate > 0.95) {
      return 'excellent';
    } else if (health.responseTime && health.responseTime < 3000 && health.metrics.successRate > 0.8) {
      return 'good';
    } else if (health.metrics.successRate < 0.5) {
      return 'poor';
    }
    
    return 'unknown';
  }

  private getBatteryLevel(): number | undefined {
    if ('getBattery' in navigator) {
      // Note: getBattery() is deprecated, this is for demonstration
      return undefined;
    }
    return undefined;
  }

  private recordSyncHistory(progress: SyncProgress): void {
    this.syncHistory.push({
      timestamp: Date.now(),
      duration: Date.now() - (this.syncContext?.lastSyncTimestamp || Date.now()),
      itemsSynced: progress.syncedItems,
      success: progress.phase === 'completed'
    });

    // Keep only last 20 sync records
    if (this.syncHistory.length > 20) {
      this.syncHistory.shift();
    }
  }

  private isPromisePending(promise: Promise<any>): boolean {
    // Simplified check - in practice, you'd track promise states
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get sync history
   */
  getSyncHistory(): typeof this.syncHistory {
    return [...this.syncHistory];
  }

  /**
   * Update sync configuration
   */
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current sync configuration
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStats(): any {
    return {
      activeSyncs: this.activeSyncs.size,
      syncHistory: this.syncHistory.length,
      lastSync: this.syncHistory.length > 0 ? this.syncHistory[this.syncHistory.length - 1] : null,
      totalSyncs: this.syncHistory.length,
      successfulSyncs: this.syncHistory.filter(s => s.success).length
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.syncHistory = [];
    this.activeSyncs.clear();
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.activeSyncs.clear();
    this.syncHistory = [];
  }
}