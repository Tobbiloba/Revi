import { StorageManager } from './storage-manager';
import { NetworkManager } from './network-manager';
import type { ErrorEvent, SessionEvent, NetworkEvent, ReviConfig } from './types';

export class DataManager {
  private config: ReviConfig;
  private storageManager: StorageManager;
  private networkManager: NetworkManager;
  private uploadTimer: NodeJS.Timeout | null = null;
  private isUploading = false;
  private retryAttempts = new Map<string, number>();
  private uploadQueue: {
    errors: ErrorEvent[];
    sessionEvents: SessionEvent[];
    networkEvents: NetworkEvent[];
  } = {
    errors: [],
    sessionEvents: [],
    networkEvents: []
  };

  constructor(config: ReviConfig) {
    this.config = config;
    this.storageManager = new StorageManager();
    this.networkManager = new NetworkManager();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.storageManager.initialize();
      await this.loadQueueFromStorage();
      this.startNetworkAwareUploadTimer();
      this.setupBeforeUnloadHandler();
      this.setupNetworkChangeHandler();
    } catch (error) {
      console.error('[Revi] Failed to initialize data manager:', error);
    }
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      const storedData = await this.storageManager.getAllData();
      this.uploadQueue = storedData;
    } catch (error) {
      console.error('[Revi] Failed to load queue from storage:', error);
    }
  }

  private async saveQueueToStorage(): Promise<void> {
    try {
      await this.storageManager.clearAll();
      if (this.uploadQueue.errors.length > 0) {
        await this.storageManager.storeErrors(this.uploadQueue.errors);
      }
      if (this.uploadQueue.sessionEvents.length > 0) {
        await this.storageManager.storeSessionEvents(this.uploadQueue.sessionEvents);
      }
      if (this.uploadQueue.networkEvents.length > 0) {
        await this.storageManager.storeNetworkEvents(this.uploadQueue.networkEvents);
      }
    } catch (error) {
      console.error('[Revi] Failed to save queue to storage:', error);
    }
  }

  private startNetworkAwareUploadTimer(): void {
    const scheduleNextUpload = () => {
      if (this.uploadTimer) {
        clearTimeout(this.uploadTimer);
      }

      const delay = this.networkManager.getUploadDelay();
      if (delay > 0) {
        this.uploadTimer = setTimeout(() => {
          if (!this.isUploading && this.hasQueuedData()) {
            this.uploadData().finally(() => {
              scheduleNextUpload();
            });
          } else {
            scheduleNextUpload();
          }
        }, delay);
      }
    };

    scheduleNextUpload();
  }

  private setupNetworkChangeHandler(): void {
    this.networkManager.onConnectionChange((online) => {
      if (online) {
        console.log('[Revi] Network connection restored, resuming uploads');
        if (this.hasQueuedData() && !this.isUploading) {
          // Wait a bit before starting uploads to ensure connection is stable
          setTimeout(() => {
            this.uploadData();
          }, 1000);
        }
      } else {
        console.log('[Revi] Network connection lost, uploads paused');
      }
    });
  }

  private setupBeforeUnloadHandler(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeunload', () => {
      if (this.hasQueuedData()) {
        this.uploadDataSync();
      }
    });
  }

  queueError(error: ErrorEvent): void {
    this.uploadQueue.errors.push(error);
    this.saveQueueToStorage().catch(err => {
      console.error('[Revi] Failed to save error to storage:', err);
    });
  }

  queueSessionEvents(events: SessionEvent[]): void {
    this.uploadQueue.sessionEvents.push(...events);
    this.saveQueueToStorage().catch(err => {
      console.error('[Revi] Failed to save session events to storage:', err);
    });
  }

  queueNetworkEvents(events: NetworkEvent[]): void {
    this.uploadQueue.networkEvents.push(...events);
    this.saveQueueToStorage().catch(err => {
      console.error('[Revi] Failed to save network events to storage:', err);
    });
  }

  private hasQueuedData(): boolean {
    return this.uploadQueue.errors.length > 0 ||
           this.uploadQueue.sessionEvents.length > 0 ||
           this.uploadQueue.networkEvents.length > 0;
  }

  private async uploadData(): Promise<void> {
    if (this.isUploading || !this.hasQueuedData()) return;

    const { online } = this.networkManager.getConnectionStatus();
    if (!online) {
      console.log('[Revi] Skipping upload - device is offline');
      return;
    }

    this.isUploading = true;
    const apiUrl = this.config.apiUrl || 'https://api.revi.dev';
    const batchSize = this.networkManager.getBatchSize();

    try {
      // Upload errors in batches
      if (this.uploadQueue.errors.length > 0) {
        const errorBatches = this.createBatches(this.uploadQueue.errors, batchSize);
        for (const batch of errorBatches) {
          await this.uploadErrorsWithRetry(apiUrl, batch);
        }
        this.uploadQueue.errors = [];
      }

      // Upload session events in batches
      if (this.uploadQueue.sessionEvents.length > 0) {
        const sessionBatches = this.createBatches(this.uploadQueue.sessionEvents, batchSize);
        for (const batch of sessionBatches) {
          await this.uploadSessionEventsWithRetry(apiUrl, batch);
        }
        this.uploadQueue.sessionEvents = [];
      }

      // Upload network events in batches
      if (this.uploadQueue.networkEvents.length > 0) {
        const networkBatches = this.createBatches(this.uploadQueue.networkEvents, batchSize);
        for (const batch of networkBatches) {
          await this.uploadNetworkEventsWithRetry(apiUrl, batch);
        }
        this.uploadQueue.networkEvents = [];
      }

      await this.saveQueueToStorage();
      
      // Reset retry attempts on successful upload
      this.retryAttempts.clear();
      
    } catch (error) {
      if (this.config.debug) {
        console.error('Revi: Failed to upload data', error);
      }
      // Keep data in queue for retry
    } finally {
      this.isUploading = false;
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    if (batchSize <= 0) return [];
    
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private uploadDataSync(): void {
    if (!this.hasQueuedData()) return;

    const apiUrl = this.config.apiUrl || 'https://api.revi.dev';

    // Use sendBeacon for synchronous upload on page unload
    if (navigator.sendBeacon) {
      if (this.uploadQueue.errors.length > 0) {
        const payload = JSON.stringify({ errors: this.uploadQueue.errors });
        navigator.sendBeacon(`${apiUrl}/api/capture/error`, payload);
      }

      if (this.uploadQueue.sessionEvents.length > 0) {
        const payload = JSON.stringify({ 
          session_id: this.uploadQueue.sessionEvents[0]?.sessionId,
          events: this.uploadQueue.sessionEvents.map(e => ({
            event_type: e.type,
            data: e.data,
            timestamp: e.timestamp,
            session_id: e.sessionId
          }))
        });
        navigator.sendBeacon(`${apiUrl}/api/capture/session-event`, payload);
      }

      if (this.uploadQueue.networkEvents.length > 0) {
        const payload = JSON.stringify({ events: this.uploadQueue.networkEvents });
        navigator.sendBeacon(`${apiUrl}/api/capture/network-event`, payload);
      }
    }
  }

  private async uploadErrors(apiUrl: string, errors: ErrorEvent[]): Promise<void> {
    const response = await fetch(`${apiUrl}/api/capture/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify({
        errors: errors.map(error => ({
          message: error.message,
          stack_trace: error.stack,
          url: error.url,
          user_agent: error.userAgent,
          session_id: error.sessionId,
          metadata: {
            id: error.id,
            userId: error.userId,
            environment: error.environment,
            release: error.release,
            tags: error.tags,
            extra: error.extra,
            breadcrumbs: error.breadcrumbs,
            level: error.level,
            lineno: error.lineno,
            colno: error.colno,
            filename: error.filename
          }
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
  }

  private async uploadSessionEvents(apiUrl: string, events: SessionEvent[]): Promise<void> {
    if (events.length === 0) return;

    const sessionId = events[0].sessionId;
    const response = await fetch(`${apiUrl}/api/capture/session-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify({
        session_id: sessionId,
        events: events.map(event => ({
          event_type: event.type,
          data: event.data,
          timestamp: event.timestamp,
          session_id: event.sessionId
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
  }

  private async uploadNetworkEvents(apiUrl: string, events: NetworkEvent[]): Promise<void> {
    const promises = events.map(event => 
      fetch(`${apiUrl}/api/capture/network-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          session_id: event.sessionId,
          events: [{
            method: event.method,
            url: event.url,
            status_code: event.statusCode,
            response_time: event.responseTime,
            timestamp: event.timestamp,
            session_id: event.sessionId,
            request_data: {
              headers: event.requestHeaders || {},
              body: event.requestBody || null,
              size: event.requestSize || 0
            },
            response_data: {
              headers: event.responseHeaders || {},
              body: event.responseBody || null,
              size: event.responseSize || 0
            }
          }]
        })
      })
    );

    const responses = await Promise.allSettled(promises);
    const failures = responses.filter(r => r.status === 'rejected');
    
    if (failures.length > 0) {
      throw new Error(`${failures.length} network event uploads failed`);
    }
  }

  private async uploadErrorsWithRetry(apiUrl: string, errors: ErrorEvent[]): Promise<void> {
    const key = 'errors';
    return this.executeWithRetry(key, () => this.uploadErrors(apiUrl, errors));
  }

  private async uploadSessionEventsWithRetry(apiUrl: string, events: SessionEvent[]): Promise<void> {
    const key = 'session_events';
    return this.executeWithRetry(key, () => this.uploadSessionEvents(apiUrl, events));
  }

  private async uploadNetworkEventsWithRetry(apiUrl: string, events: NetworkEvent[]): Promise<void> {
    const key = 'network_events';  
    return this.executeWithRetry(key, () => this.uploadNetworkEvents(apiUrl, events));
  }

  private async executeWithRetry<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const currentAttempt = this.retryAttempts.get(key) || 0;

    if (!this.networkManager.shouldRetry(currentAttempt)) {
      throw new Error(`Max retry attempts exceeded for ${key}`);
    }

    try {
      const result = await operation();
      this.retryAttempts.delete(key); // Success, reset retry count
      return result;
    } catch (error) {
      this.retryAttempts.set(key, currentAttempt + 1);
      
      if (this.networkManager.shouldRetry(currentAttempt + 1)) {
        const delay = this.networkManager.getRetryDelay(currentAttempt + 1);
        console.log(`[Revi] Upload failed for ${key}, retrying in ${delay}ms (attempt ${currentAttempt + 2})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(key, operation);
      } else {
        console.error(`[Revi] Max retry attempts exceeded for ${key}:`, error);
        throw error;
      }
    }
  }

  async clearQueue(): Promise<void> {
    this.uploadQueue = {
      errors: [],
      sessionEvents: [],
      networkEvents: []
    };
    
    await this.storageManager.clearAll();
  }

  destroy(): void {
    if (this.uploadTimer) {
      clearTimeout(this.uploadTimer);
      this.uploadTimer = null;
    }
    
    // Final upload attempt
    if (this.hasQueuedData()) {
      this.uploadDataSync();
    }
  }
}
