/**
 * Resilient Storage System with Prioritization and Quota Management
 * Multi-tier storage with intelligent data management
 */

import { ErrorEvent, SessionEvent, NetworkEvent } from './types';
import { compressData, deduplicateEvents } from './compression-utils';

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
  retentionTime: number; // milliseconds
  priority: number; // 1 = highest
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
export class ResilientStorage {
  private tiers: Map<StorageTier['name'], StorageTier> = new Map();
  private indexedDB: IDBDatabase | null = null;
  private localStorage: Storage | null = null;
  private memoryStore: Map<string, StoredItem> = new Map();
  private quotaManager: StorageQuotaManager;
  private initialized = false;
  private compressionWorker: Worker | null = null;

  constructor() {
    this.initializeTiers();
    this.quotaManager = new StorageQuotaManager();
    this.initializeCompressionWorker();
  }

  private initializeTiers(): void {
    // Hot tier: In-memory, immediate access, critical data
    this.tiers.set('hot', {
      name: 'hot',
      maxSize: 5 * 1024 * 1024, // 5MB
      compressionEnabled: false,
      encryptionEnabled: false,
      retentionTime: 5 * 60 * 1000, // 5 minutes
      priority: 1
    });

    // Warm tier: IndexedDB, fast access, important data
    this.tiers.set('warm', {
      name: 'warm',
      maxSize: 50 * 1024 * 1024, // 50MB
      compressionEnabled: true,
      encryptionEnabled: false,
      retentionTime: 24 * 60 * 60 * 1000, // 24 hours
      priority: 2
    });

    // Cold tier: LocalStorage, slower access, archived data
    this.tiers.set('cold', {
      name: 'cold',
      maxSize: 10 * 1024 * 1024, // 10MB (localStorage limit)
      compressionEnabled: true,
      encryptionEnabled: true,
      retentionTime: 7 * 24 * 60 * 60 * 1000, // 7 days
      priority: 3
    });
  }

  private async initializeCompressionWorker(): Promise<void> {
    if (typeof Worker !== 'undefined') {
      try {
        // Create compression worker for background processing
        const workerCode = `
          self.onmessage = function(e) {
            const { action, data, id } = e.data;
            
            if (action === 'compress') {
              // Simple compression simulation
              const compressed = JSON.stringify(data);
              self.postMessage({ id, result: compressed, compressed: true });
            } else if (action === 'decompress') {
              try {
                const decompressed = JSON.parse(data);
                self.postMessage({ id, result: decompressed, compressed: false });
              } catch (error) {
                self.postMessage({ id, error: error.message });
              }
            }
          };
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.compressionWorker = new Worker(URL.createObjectURL(blob));
      } catch (error) {
        console.warn('[ResilientStorage] Compression worker not available:', error);
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.initializeIndexedDB(),
      this.initializeLocalStorage(),
      this.quotaManager.initialize()
    ]);

    // Start background cleanup
    this.startBackgroundCleanup();
    
    this.initialized = true;
  }

  private async initializeIndexedDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ReviResilientStorage', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.indexedDB = request.result;
        resolve();
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        
        // Create stores for each data type
        if (!db.objectStoreNames.contains('errors')) {
          db.createObjectStore('errors', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('network')) {
          db.createObjectStore('network', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  private initializeLocalStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      this.localStorage = window.localStorage;
    }
  }

  /**
   * Store data with intelligent tier selection
   */
  async store<T>(
    type: 'error' | 'session' | 'network',
    data: T,
    options: {
      priority?: 'critical' | 'high' | 'medium' | 'low';
      ttl?: number;
      forceSync?: boolean;
    } = {}
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const { priority = 'medium', ttl, forceSync = false } = options;
    
    // Generate unique ID
    const id = this.generateId(type);
    
    // Calculate data size
    const dataSize = this.calculateSize(data);
    
    // Determine optimal tier
    const tier = this.selectOptimalTier(priority, dataSize, forceSync);
    
    // Create storage item
    const item: StoredItem<T> = {
      id,
      data,
      priority,
      timestamp: Date.now(),
      size: dataSize,
      compressed: false,
      encrypted: false,
      retryCount: 0,
      tier: tier.name,
      expiresAt: ttl ? Date.now() + ttl : undefined,
      checksum: this.calculateChecksum(data)
    };

    // Store in selected tier
    await this.storeInTier(item, tier);
    
    return id;
  }

  private selectOptimalTier(
    priority: 'critical' | 'high' | 'medium' | 'low',
    dataSize: number,
    forceSync: boolean
  ): StorageTier {
    // Critical data or force sync -> hot tier
    if (priority === 'critical' || forceSync) {
      return this.tiers.get('hot')!;
    }

    // High priority or small data -> warm tier
    if (priority === 'high' || dataSize < 10240) { // < 10KB
      return this.tiers.get('warm')!;
    }

    // Everything else -> cold tier
    return this.tiers.get('cold')!;
  }

  private async storeInTier<T>(item: StoredItem<T>, tier: StorageTier): Promise<void> {
    // Check quota before storing
    if (!await this.checkQuotaAvailable(tier, item.size)) {
      await this.makeSpace(tier, item.size);
    }

    switch (tier.name) {
      case 'hot':
        await this.storeInMemory(item);
        break;
      case 'warm':
        await this.storeInIndexedDB(item, tier);
        break;
      case 'cold':
        await this.storeInLocalStorage(item, tier);
        break;
    }
  }

  private async storeInMemory<T>(item: StoredItem<T>): Promise<void> {
    this.memoryStore.set(item.id, item);
  }

  private async storeInIndexedDB<T>(item: StoredItem<T>, tier: StorageTier): Promise<void> {
    if (!this.indexedDB) throw new Error('IndexedDB not available');

    // Compress data if enabled
    if (tier.compressionEnabled) {
      const compressed = await this.compressData(item.data);
      if (compressed.compressed) {
        item.data = compressed.data as T;
        item.compressed = true;
        item.size = this.calculateSize(item.data);
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction(['errors', 'sessions', 'network'], 'readwrite');
      const store = transaction.objectStore(this.getStoreNameFromId(item.id));
      
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async storeInLocalStorage<T>(item: StoredItem<T>, tier: StorageTier): Promise<void> {
    if (!this.localStorage) throw new Error('LocalStorage not available');

    // Compress and encrypt data if enabled
    let processedData = item.data;
    
    if (tier.compressionEnabled) {
      const compressed = await this.compressData(processedData);
      if (compressed.compressed) {
        processedData = compressed.data;
        item.compressed = true;
      }
    }

    if (tier.encryptionEnabled) {
      processedData = await this.encryptData(processedData);
      item.encrypted = true;
    }

    item.data = processedData as T;
    item.size = this.calculateSize(item.data);

    try {
      this.localStorage.setItem(`revi_${item.id}`, JSON.stringify(item));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        await this.makeSpace(tier, item.size);
        this.localStorage.setItem(`revi_${item.id}`, JSON.stringify(item));
      } else {
        throw error;
      }
    }
  }

  /**
   * Retrieve data with automatic tier searching
   */
  async retrieve<T>(id: string): Promise<StoredItem<T> | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Search in priority order: hot -> warm -> cold
    const tiers: StorageTier['name'][] = ['hot', 'warm', 'cold'];
    
    for (const tierName of tiers) {
      const item = await this.retrieveFromTier<T>(id, tierName);
      if (item) {
        // Validate item integrity
        if (!this.validateItemIntegrity(item)) {
          console.warn(`[ResilientStorage] Data integrity check failed for ${id}`);
          continue;
        }
        
        // Promote frequently accessed data to higher tier
        if (tierName !== 'hot' && this.shouldPromote(item)) {
          await this.promoteItem(item);
        }
        
        return item;
      }
    }
    
    return null;
  }

  private async retrieveFromTier<T>(id: string, tierName: StorageTier['name']): Promise<StoredItem<T> | null> {
    switch (tierName) {
      case 'hot':
        return this.memoryStore.get(id) as StoredItem<T> || null;
      case 'warm':
        return this.retrieveFromIndexedDB<T>(id);
      case 'cold':
        return this.retrieveFromLocalStorage<T>(id);
    }
  }

  private async retrieveFromIndexedDB<T>(id: string): Promise<StoredItem<T> | null> {
    if (!this.indexedDB) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction(['errors', 'sessions', 'network'], 'readonly');
      const store = transaction.objectStore(this.getStoreNameFromId(id));
      
      const request = store.get(id);
      request.onsuccess = async () => {
        const item = request.result as StoredItem<T>;
        if (item && item.compressed) {
          const decompressed = await this.decompressData(item.data);
          item.data = decompressed as T;
          item.compressed = false;
        }
        resolve(item || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async retrieveFromLocalStorage<T>(id: string): Promise<StoredItem<T> | null> {
    if (!this.localStorage) return null;

    try {
      const itemJson = this.localStorage.getItem(`revi_${id}`);
      if (!itemJson) return null;

      const item = JSON.parse(itemJson) as StoredItem<T>;
      
      // Decrypt if encrypted
      if (item.encrypted) {
        item.data = await this.decryptData(item.data);
        item.encrypted = false;
      }
      
      // Decompress if compressed
      if (item.compressed) {
        const decompressed = await this.decompressData(item.data);
        item.data = decompressed as T;
        item.compressed = false;
      }
      
      return item;
    } catch (error) {
      console.error(`[ResilientStorage] Failed to retrieve ${id}:`, error);
      return null;
    }
  }

  /**
   * Get all items by type with priority ordering
   */
  async getAllByType<T>(type: 'error' | 'session' | 'network'): Promise<StoredItem<T>[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const items: StoredItem<T>[] = [];
    
    // Collect from all tiers
    for (const tierName of ['hot', 'warm', 'cold'] as const) {
      const tierItems = await this.getAllFromTier<T>(type, tierName);
      items.push(...tierItems);
    }

    // Sort by priority and timestamp
    return items.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp; // Older first
    });
  }

  private async getAllFromTier<T>(type: string, tierName: StorageTier['name']): Promise<StoredItem<T>[]> {
    switch (tierName) {
      case 'hot':
        return Array.from(this.memoryStore.values())
          .filter(item => item.id.startsWith(type)) as StoredItem<T>[];
      case 'warm':
        return this.getAllFromIndexedDB<T>(type);
      case 'cold':
        return this.getAllFromLocalStorage<T>(type);
    }
  }

  private async getAllFromIndexedDB<T>(type: string): Promise<StoredItem<T>[]> {
    if (!this.indexedDB) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction([this.getStoreName(type)], 'readonly');
      const store = transaction.objectStore(this.getStoreName(type));
      
      const request = store.getAll();
      request.onsuccess = async () => {
        const items = request.result as StoredItem<T>[];
        
        // Decompress items if needed
        for (const item of items) {
          if (item.compressed) {
            const decompressed = await this.decompressData(item.data);
            item.data = decompressed as T;
            item.compressed = false;
          }
        }
        
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllFromLocalStorage<T>(type: string): Promise<StoredItem<T>[]> {
    if (!this.localStorage) return [];

    const items: StoredItem<T>[] = [];
    
    for (let i = 0; i < this.localStorage.length; i++) {
      const key = this.localStorage.key(i);
      if (key && key.startsWith(`revi_${type}`)) {
        try {
          const itemJson = this.localStorage.getItem(key);
          if (itemJson) {
            const item = JSON.parse(itemJson) as StoredItem<T>;
            
            // Decrypt and decompress if needed
            if (item.encrypted) {
              item.data = await this.decryptData(item.data);
              item.encrypted = false;
            }
            if (item.compressed) {
              const decompressed = await this.decompressData(item.data);
              item.data = decompressed as T;
              item.compressed = false;
            }
            
            items.push(item);
          }
        } catch (error) {
          console.error(`[ResilientStorage] Failed to parse item ${key}:`, error);
        }
      }
    }
    
    return items;
  }

  /**
   * Remove item from all tiers
   */
  async remove(id: string): Promise<void> {
    // Remove from all tiers
    this.memoryStore.delete(id);
    
    if (this.indexedDB) {
      const transaction = this.indexedDB.transaction(['errors', 'sessions', 'network'], 'readwrite');
      const store = transaction.objectStore(this.getStoreNameFromId(id));
      store.delete(id);
    }
    
    if (this.localStorage) {
      this.localStorage.removeItem(`revi_${id}`);
    }
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.memoryStore.clear();
    
    if (this.indexedDB) {
      const transaction = this.indexedDB.transaction(['errors', 'sessions', 'network'], 'readwrite');
      transaction.objectStore('errors').clear();
      transaction.objectStore('sessions').clear();
      transaction.objectStore('network').clear();
    }
    
    if (this.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < this.localStorage.length; i++) {
        const key = this.localStorage.key(i);
        if (key && key.startsWith('revi_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => this.localStorage!.removeItem(key));
    }
  }

  private async checkQuotaAvailable(tier: StorageTier, requiredSize: number): Promise<boolean> {
    const usage = await this.quotaManager.getUsage(tier.name);
    return (usage.available >= requiredSize);
  }

  private async makeSpace(tier: StorageTier, requiredSize: number): Promise<void> {
    // Remove expired items first
    await this.cleanupExpiredItems(tier);
    
    // Check if we have enough space now
    if (await this.checkQuotaAvailable(tier, requiredSize)) {
      return;
    }
    
    // Remove old, low-priority items
    await this.evictLowPriorityItems(tier, requiredSize);
  }

  private async cleanupExpiredItems(tier: StorageTier): Promise<void> {
    const now = Date.now();
    
    switch (tier.name) {
      case 'hot':
        for (const [id, item] of this.memoryStore) {
          if ((item.expiresAt && now > item.expiresAt) || 
              (now - item.timestamp > tier.retentionTime)) {
            this.memoryStore.delete(id);
          }
        }
        break;
        
      case 'warm':
        if (this.indexedDB) {
          // Implementation for IndexedDB cleanup
          const stores = ['errors', 'sessions', 'network'];
          for (const storeName of stores) {
            await this.cleanupIndexedDBStore(storeName, tier.retentionTime);
          }
        }
        break;
        
      case 'cold':
        if (this.localStorage) {
          await this.cleanupLocalStorage(tier.retentionTime);
        }
        break;
    }
  }

  private async evictLowPriorityItems(tier: StorageTier, requiredSize: number): Promise<void> {
    // Get items sorted by priority (low priority first) and age (old first)
    const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    let evictedSize = 0;
    
    // This is a simplified implementation - in practice, you'd implement
    // more sophisticated eviction policies per tier
    if (tier.name === 'hot') {
      const sortedItems = Array.from(this.memoryStore.values()).sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp - b.timestamp;
      });
      
      for (const item of sortedItems) {
        if (evictedSize >= requiredSize) break;
        this.memoryStore.delete(item.id);
        evictedSize += item.size;
      }
    }
  }

  // Helper methods
  private generateId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimation (UTF-16)
  }

  private calculateChecksum(data: any): string {
    // Simple checksum using JSON string hash
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private validateItemIntegrity(item: StoredItem): boolean {
    if (!item.checksum) return true; // No checksum to validate
    
    const currentChecksum = this.calculateChecksum(item.data);
    return currentChecksum === item.checksum;
  }

  private shouldPromote(item: StoredItem): boolean {
    // Promote critical items or frequently accessed items
    return item.priority === 'critical' || 
           (item.priority === 'high' && Date.now() - item.timestamp < 300000); // 5 minutes
  }

  private async promoteItem<T>(item: StoredItem<T>): Promise<void> {
    // Move item to hot tier
    const hotTier = this.tiers.get('hot')!;
    await this.storeInTier(item, hotTier);
    
    // Remove from current tier (this is simplified)
    await this.remove(item.id);
  }

  private async compressData(data: any): Promise<{ data: any; compressed: boolean }> {
    if (this.compressionWorker) {
      // Use web worker for compression
      return new Promise((resolve) => {
        const id = Math.random().toString();
        
        const handleMessage = (e: MessageEvent) => {
          if (e.data.id === id) {
            this.compressionWorker!.removeEventListener('message', handleMessage);
            resolve({ data: e.data.result, compressed: e.data.compressed });
          }
        };
        
        this.compressionWorker.addEventListener('message', handleMessage);
        this.compressionWorker.postMessage({ action: 'compress', data, id });
      });
    }
    
    // Fallback to synchronous compression
    try {
      const result = await compressData(data);
      return { data: result.data, compressed: result.compressed };
    } catch (error) {
      return { data, compressed: false };
    }
  }

  private async decompressData(data: any): Promise<any> {
    if (this.compressionWorker) {
      return new Promise((resolve, reject) => {
        const id = Math.random().toString();
        
        const handleMessage = (e: MessageEvent) => {
          if (e.data.id === id) {
            this.compressionWorker!.removeEventListener('message', handleMessage);
            if (e.data.error) {
              reject(new Error(e.data.error));
            } else {
              resolve(e.data.result);
            }
          }
        };
        
        this.compressionWorker.addEventListener('message', handleMessage);
        this.compressionWorker.postMessage({ action: 'decompress', data, id });
      });
    }
    
    // Fallback
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  private async encryptData(data: any): Promise<any> {
    // Simple encryption simulation - in production, use proper encryption
    const str = JSON.stringify(data);
    return btoa(str); // Base64 encoding as simulation
  }

  private async decryptData(encryptedData: any): Promise<any> {
    // Simple decryption simulation
    try {
      const str = atob(encryptedData);
      return JSON.parse(str);
    } catch (error) {
      throw new Error('Failed to decrypt data');
    }
  }

  private getStoreName(type: string): string {
    switch (type) {
      case 'error': return 'errors';
      case 'session': return 'sessions';
      case 'network': return 'network';
      default: return 'errors';
    }
  }

  private getStoreNameFromId(id: string): string {
    if (id.startsWith('error_')) return 'errors';
    if (id.startsWith('session_')) return 'sessions';
    if (id.startsWith('network_')) return 'network';
    return 'errors';
  }

  private async cleanupIndexedDBStore(storeName: string, retentionTime: number): Promise<void> {
    // Implementation for cleaning up expired items from IndexedDB
    // This is a placeholder - implement based on your needs
  }

  private async cleanupLocalStorage(retentionTime: number): Promise<void> {
    if (!this.localStorage) return;
    
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < this.localStorage.length; i++) {
      const key = this.localStorage.key(i);
      if (key && key.startsWith('revi_')) {
        try {
          const itemJson = this.localStorage.getItem(key);
          if (itemJson) {
            const item = JSON.parse(itemJson);
            if (now - item.timestamp > retentionTime) {
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          // Invalid item, remove it
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => this.localStorage!.removeItem(key));
  }

  private startBackgroundCleanup(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.tiers.forEach(async (tier) => {
        await this.cleanupExpiredItems(tier);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Store data with resilience features
   */
  async storeData(key: string, data: any, options: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    tier?: 'hot' | 'warm' | 'cold';
    compress?: boolean;
    encrypt?: boolean;
  }): Promise<void> {
    const tier = this.selectOptimalTier(options.priority, JSON.stringify(data).length);
    const storage = this.storageProviders.get(tier);
    if (!storage) {
      throw new Error(`Storage tier ${tier} not available`);
    }

    let processedData = data;
    if (options.compress) {
      processedData = this.compressData(data);
    }

    await storage.setItem(key, JSON.stringify({
      data: processedData,
      metadata: {
        priority: options.priority,
        tier,
        compressed: options.compress || false,
        timestamp: Date.now()
      }
    }));
  }

  /**
   * Get stored data
   */
  async getData(key: string): Promise<any> {
    for (const [tierName, storage] of this.storageProviders) {
      try {
        const item = await storage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          return parsed.metadata?.compressed ? this.decompressData(parsed.data) : parsed.data;
        }
      } catch (error) {
        console.warn(`Failed to read from ${tierName}:`, error);
      }
    }
    return null;
  }

  /**
   * Delete stored data
   */
  async deleteData(key: string): Promise<void> {
    await Promise.all(
      Array.from(this.storageProviders.values()).map(storage =>
        storage.removeItem(key).catch(() => {}) // Ignore errors
      )
    );
  }

  /**
   * Get all data matching pattern
   */
  async getAllDataByPattern(pattern: string): Promise<Array<{key: string, data: any, metadata?: any}>> {
    const results: Array<{key: string, data: any, metadata?: any}> = [];
    const regex = new RegExp(pattern.replace('*', '.*'));

    for (const [tierName, storage] of this.storageProviders) {
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && regex.test(key)) {
            const item = await storage.getItem(key);
            if (item) {
              const parsed = JSON.parse(item);
              results.push({
                key,
                data: parsed.metadata?.compressed ? this.decompressData(parsed.data) : parsed.data,
                metadata: parsed.metadata
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to scan ${tierName}:`, error);
      }
    }

    return results;
  }

  private selectOptimalTier(priority: string, dataSize: number): 'hot' | 'warm' | 'cold' {
    if (priority === 'critical') return 'hot';
    if (priority === 'high' && dataSize < 10000) return 'hot';
    if (priority === 'low' || dataSize > 100000) return 'cold';
    return 'warm';
  }

  private compressData(data: any): any {
    // Simple compression simulation
    return data;
  }

  private decompressData(data: any): any {
    // Simple decompression simulation
    return data;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    // Implementation placeholder
    const stats: StorageStats = {
      totalItems: 0,
      totalSize: 0,
      itemsByPriority: { critical: 0, high: 0, medium: 0, low: 0 },
      itemsByTier: { hot: 0, warm: 0, cold: 0 },
      compressionRatio: 0.7,
      quotaUsage: await this.quotaManager.getTotalUsage(),
      tierUsage: {
        hot: { itemCount: 0, sizeBytes: 0, quotaUsed: 0 },
        warm: { itemCount: 0, sizeBytes: 0, quotaUsed: 0 },
        cold: { itemCount: 0, sizeBytes: 0, quotaUsed: 0 }
      }
    };
    
    return stats;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ResilientStorageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    // Reset internal counters if any
  }
}

/**
 * Storage Quota Manager
 */
class StorageQuotaManager {
  private quotas: Map<string, StorageQuota> = new Map();

  async initialize(): Promise<void> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const total = estimate.quota || 0;
      const used = estimate.usage || 0;
      
      this.quotas.set('global', {
        total,
        used,
        available: total - used,
        percentage: total > 0 ? (used / total) * 100 : 0
      });
    }
  }

  async getUsage(tierName: string): Promise<StorageQuota> {
    // Simplified implementation - in practice, calculate per-tier usage
    return this.quotas.get('global') || {
      total: 0,
      used: 0,
      available: 0,
      percentage: 0
    };
  }

  async getTotalUsage(): Promise<StorageQuota> {
    return this.quotas.get('global') || {
      total: 0,
      used: 0,
      available: 0,
      percentage: 0
    };
  }
}