import type { ErrorEvent, SessionEvent, NetworkEvent } from './types';

interface StorageItem {
  id: string;
  type: 'error' | 'session' | 'network';
  data: any;
  timestamp: number;
  compressed: boolean;
}

export class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private dbName = 'revi-storage';
  private version = 1;
  private storeName = 'queue';
  private maxQueueSize = 1000;
  private maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB not supported');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  async store(type: 'error' | 'session' | 'network', data: any): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    await this.cleanupExpiredItems();
    
    const queueSize = await this.getQueueSize();
    if (queueSize >= this.maxQueueSize) {
      await this.removeOldestItems(100);
    }

    const item: StorageItem = {
      id: this.generateId(),
      type,
      data: await this.compress(data),
      timestamp: Date.now(),
      compressed: true
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.add(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store item'));
    });
  }

  async getAll(): Promise<{ errors: ErrorEvent[]; sessionEvents: SessionEvent[]; networkEvents: NetworkEvent[] }> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = async () => {
        const items = request.result as StorageItem[];
        const result = {
          errors: [] as ErrorEvent[],
          sessionEvents: [] as SessionEvent[],
          networkEvents: [] as NetworkEvent[]
        };

        for (const item of items) {
          const decompressedData = await this.decompress(item.data);
          
          switch (item.type) {
            case 'error':
              result.errors.push(...(Array.isArray(decompressedData) ? decompressedData : [decompressedData]));
              break;
            case 'session':
              result.sessionEvents.push(...(Array.isArray(decompressedData) ? decompressedData : [decompressedData]));
              break;
            case 'network':
              result.networkEvents.push(...(Array.isArray(decompressedData) ? decompressedData : [decompressedData]));
              break;
          }
        }

        resolve(result);
      };

      request.onerror = () => reject(new Error('Failed to retrieve items'));
    });
  }

  async clear(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear storage'));
    });
  }

  async getQueueSize(): Promise<number> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get queue size'));
    });
  }

  private async cleanupExpiredItems(): Promise<void> {
    if (!this.db) return;

    const cutoffTime = Date.now() - this.maxAge;

    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const index = objectStore.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => resolve();
    });
  }

  private async removeOldestItems(count: number): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const index = objectStore.index('timestamp');
      const request = index.openCursor();

      let deletedCount = 0;
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && deletedCount < count) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => resolve();
    });
  }

  private async compress(data: any): Promise<string> {
    try {
      const json = JSON.stringify(data);
      // Simple base64 compression for now - can be upgraded to gzip
      return btoa(unescape(encodeURIComponent(json)));
    } catch (error) {
      // Fallback to uncompressed JSON string
      return JSON.stringify(data);
    }
  }

  private async decompress(data: string): Promise<any> {
    try {
      // Try to decode base64 first
      const decoded = decodeURIComponent(escape(atob(data)));
      return JSON.parse(decoded);
    } catch (error) {
      // Fallback to direct JSON parse
      try {
        return JSON.parse(data);
      } catch (parseError) {
        return data;
      }
    }
  }

  private generateId(): string {
    return `revi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}