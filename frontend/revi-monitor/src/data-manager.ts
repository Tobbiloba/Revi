import { getLocalStorage } from './utils';
import type { ErrorEvent, SessionEvent, NetworkEvent, ReviConfig } from './types';

interface QueuedData {
  errors: ErrorEvent[];
  sessionEvents: SessionEvent[];
  networkEvents: NetworkEvent[];
}

export class DataManager {
  private config: ReviConfig;
  private storage: Storage | null;
  private uploadQueue: QueuedData = {
    errors: [],
    sessionEvents: [],
    networkEvents: []
  };
  private uploadTimer: NodeJS.Timeout | null = null;
  private isUploading = false;

  constructor(config: ReviConfig) {
    this.config = config;
    this.storage = getLocalStorage();
    
    this.loadQueueFromStorage();
    this.startUploadTimer();
    this.setupBeforeUnloadHandler();
  }

  private loadQueueFromStorage(): void {
    if (!this.storage) return;

    try {
      const storedData = this.storage.getItem('revi_upload_queue');
      if (storedData) {
        this.uploadQueue = JSON.parse(storedData);
      }
    } catch (e) {
      // Failed to load from storage
    }
  }

  private saveQueueToStorage(): void {
    if (!this.storage) return;

    try {
      this.storage.setItem('revi_upload_queue', JSON.stringify(this.uploadQueue));
    } catch (e) {
      // Failed to save to storage, probably quota exceeded
      this.clearQueue();
    }
  }

  private startUploadTimer(): void {
    const interval = 5000; // Upload every 5 seconds
    
    this.uploadTimer = setInterval(() => {
      if (!this.isUploading && this.hasQueuedData()) {
        this.uploadData();
      }
    }, interval);
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
    this.saveQueueToStorage();
  }

  queueSessionEvents(events: SessionEvent[]): void {
    this.uploadQueue.sessionEvents.push(...events);
    this.saveQueueToStorage();
  }

  queueNetworkEvents(events: NetworkEvent[]): void {
    this.uploadQueue.networkEvents.push(...events);
    this.saveQueueToStorage();
  }

  private hasQueuedData(): boolean {
    return this.uploadQueue.errors.length > 0 ||
           this.uploadQueue.sessionEvents.length > 0 ||
           this.uploadQueue.networkEvents.length > 0;
  }

  private async uploadData(): Promise<void> {
    if (this.isUploading || !this.hasQueuedData()) return;

    this.isUploading = true;
    const apiUrl = this.config.apiUrl || 'https://api.revi.dev';

    try {
      // Upload errors
      if (this.uploadQueue.errors.length > 0) {
        await this.uploadErrors(apiUrl, this.uploadQueue.errors);
        this.uploadQueue.errors = [];
      }

      // Upload session events
      if (this.uploadQueue.sessionEvents.length > 0) {
        await this.uploadSessionEvents(apiUrl, this.uploadQueue.sessionEvents);
        this.uploadQueue.sessionEvents = [];
      }

      // Upload network events
      if (this.uploadQueue.networkEvents.length > 0) {
        await this.uploadNetworkEvents(apiUrl, this.uploadQueue.networkEvents);
        this.uploadQueue.networkEvents = [];
      }

      this.saveQueueToStorage();
    } catch (error) {
      if (this.config.debug) {
        console.error('Revi: Failed to upload data', error);
      }
      // Keep data in queue for retry
    } finally {
      this.isUploading = false;
    }
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
      fetch(`${this.config.apiUrl}/api/capture/network-event`, {
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

  clearQueue(): void {
    this.uploadQueue = {
      errors: [],
      sessionEvents: [],
      networkEvents: []
    };
    
    if (this.storage) {
      this.storage.removeItem('revi_upload_queue');
    }
  }

  destroy(): void {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
      this.uploadTimer = null;
    }
    
    // Final upload attempt
    if (this.hasQueuedData()) {
      this.uploadDataSync();
    }
  }
}
