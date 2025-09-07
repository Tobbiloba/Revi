import { IndexedDBStorage } from './indexed-db-storage';
import { getLocalStorage } from './utils';
import type { ErrorEvent, SessionEvent, NetworkEvent } from './types';

interface StorageInterface {
  store(type: 'error' | 'session' | 'network', data: any): Promise<void>;
  getAll(): Promise<{ errors: ErrorEvent[]; sessionEvents: SessionEvent[]; networkEvents: NetworkEvent[] }>;
  clear(): Promise<void>;
  getQueueSize?(): Promise<number>;
}

class LocalStorageAdapter implements StorageInterface {
  private storage: Storage;
  private storageKey = 'revi_upload_queue';

  constructor() {
    const localStorage = getLocalStorage();
    if (!localStorage) {
      throw new Error('No storage available');
    }
    this.storage = localStorage;
  }

  async store(type: 'error' | 'session' | 'network', data: any): Promise<void> {
    try {
      const existing = await this.getAll();
      
      switch (type) {
        case 'error':
          existing.errors.push(...(Array.isArray(data) ? data : [data]));
          break;
        case 'session':
          existing.sessionEvents.push(...(Array.isArray(data) ? data : [data]));
          break;
        case 'network':
          existing.networkEvents.push(...(Array.isArray(data) ? data : [data]));
          break;
      }

      this.storage.setItem(this.storageKey, JSON.stringify(existing));
    } catch (error) {
      // Storage quota exceeded or other error
      throw new Error('Failed to store data');
    }
  }

  async getAll(): Promise<{ errors: ErrorEvent[]; sessionEvents: SessionEvent[]; networkEvents: NetworkEvent[] }> {
    try {
      const storedData = this.storage.getItem(this.storageKey);
      if (storedData) {
        return JSON.parse(storedData);
      }
    } catch (error) {
      // Failed to parse or retrieve data
    }
    
    return {
      errors: [],
      sessionEvents: [],
      networkEvents: []
    };
  }

  async clear(): Promise<void> {
    try {
      this.storage.removeItem(this.storageKey);
    } catch (error) {
      // Ignore errors
    }
  }
}

export class StorageManager {
  private storage: StorageInterface | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Try IndexedDB first
      const indexedDB = new IndexedDBStorage();
      await indexedDB.initialize();
      this.storage = indexedDB;
      console.log('[Revi] Using IndexedDB for offline storage');
    } catch (error) {
      // Fallback to localStorage
      try {
        this.storage = new LocalStorageAdapter();
        console.log('[Revi] Using localStorage for offline storage');
      } catch (localStorageError) {
        console.warn('[Revi] No storage available, data will not persist offline');
        this.storage = new NoOpStorage();
      }
    }

    this.isInitialized = true;
  }

  async storeErrors(errors: ErrorEvent[]): Promise<void> {
    await this.ensureInitialized();
    if (errors.length > 0) {
      await this.storage!.store('error', errors);
    }
  }

  async storeSessionEvents(events: SessionEvent[]): Promise<void> {
    await this.ensureInitialized();
    if (events.length > 0) {
      await this.storage!.store('session', events);
    }
  }

  async storeNetworkEvents(events: NetworkEvent[]): Promise<void> {
    await this.ensureInitialized();
    if (events.length > 0) {
      await this.storage!.store('network', events);
    }
  }

  async getAllData(): Promise<{ errors: ErrorEvent[]; sessionEvents: SessionEvent[]; networkEvents: NetworkEvent[] }> {
    await this.ensureInitialized();
    return await this.storage!.getAll();
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    await this.storage!.clear();
  }

  async getQueueSize(): Promise<number> {
    await this.ensureInitialized();
    if (this.storage && 'getQueueSize' in this.storage && this.storage.getQueueSize) {
      return await this.storage.getQueueSize();
    } else {
      // Fallback for localStorage
      const data = await this.getAllData();
      return data.errors.length + data.sessionEvents.length + data.networkEvents.length;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

class NoOpStorage implements StorageInterface {
  async store(): Promise<void> {
    // Do nothing
  }

  async getAll(): Promise<{ errors: ErrorEvent[]; sessionEvents: SessionEvent[]; networkEvents: NetworkEvent[] }> {
    return {
      errors: [],
      sessionEvents: [],
      networkEvents: []
    };
  }

  async clear(): Promise<void> {
    // Do nothing
  }
}