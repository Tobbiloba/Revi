import { StorageManager } from './storage-manager';
import { NetworkManager } from './network-manager';
import { compressData, deduplicateEvents, createOptimalBatches } from './compression-utils';
import { getDebugLogger } from './debug-logger';
import type { ErrorEvent, SessionEvent, NetworkEvent, ReviConfig } from './types';

export class DataManager {
  private config: ReviConfig;
  private storageManager: StorageManager;
  private networkManager: NetworkManager;
  private debugLogger = getDebugLogger();
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
      // Upload errors in optimized batches with compression
      if (this.uploadQueue.errors.length > 0) {
        const { events: dedupedErrors } = deduplicateEvents(this.uploadQueue.errors);
        const errorBatches = createOptimalBatches(dedupedErrors, batchSize, 32 * 1024);
        for (const batch of errorBatches) {
          await this.uploadErrorsWithRetry(apiUrl, batch);
        }
        this.uploadQueue.errors = [];
      }

      // Upload session events in optimized batches with compression
      if (this.uploadQueue.sessionEvents.length > 0) {
        const { events: dedupedEvents } = deduplicateEvents(this.uploadQueue.sessionEvents);
        const sessionBatches = createOptimalBatches(dedupedEvents, batchSize, 64 * 1024);
        for (const batch of sessionBatches) {
          await this.uploadSessionEventsWithRetry(apiUrl, batch);
        }
        this.uploadQueue.sessionEvents = [];
      }

      // Upload network events in optimized batches with compression
      if (this.uploadQueue.networkEvents.length > 0) {
        const { events: dedupedEvents } = deduplicateEvents(this.uploadQueue.networkEvents);
        const networkBatches = createOptimalBatches(dedupedEvents, batchSize, 48 * 1024);
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
    const payload = {
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
        },
        // Device information for backend processing
        device_info: error.deviceInfo ? {
          browser_name: error.deviceInfo.browser_name,
          browser_version: error.deviceInfo.browser_version,
          browser_major_version: error.deviceInfo.browser_major_version,
          os_name: error.deviceInfo.os_name,
          os_version: error.deviceInfo.os_version,
          device_type: error.deviceInfo.device_type,
          device_fingerprint: error.deviceInfo.device_fingerprint,
          screen_resolution: error.deviceInfo.screen_resolution,
          color_depth: error.deviceInfo.color_depth,
          device_pixel_ratio: error.deviceInfo.device_pixel_ratio,
          viewport_size: error.deviceInfo.viewport_size,
          platform: error.deviceInfo.platform,
          language: error.deviceInfo.language,
          timezone: error.deviceInfo.timezone,
          canvas_fingerprint: error.deviceInfo.canvas_fingerprint,
          webgl_fingerprint: error.deviceInfo.webgl_fingerprint,
          cookie_enabled: error.deviceInfo.cookie_enabled,
          local_storage_enabled: error.deviceInfo.local_storage_enabled,
          session_storage_enabled: error.deviceInfo.session_storage_enabled
        } : undefined
      }))
    };

    const { data: compressedData, compressed } = await compressData(payload);
    
    const headers: Record<string, string> = {
      'X-API-Key': this.config.apiKey
    };
    
    if (compressed) {
      headers['Content-Type'] = 'application/octet-stream';
      headers['Content-Encoding'] = 'gzip';
      headers['X-Original-Content-Type'] = 'application/json';
    } else {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${apiUrl}/api/capture/error`, {
      method: 'POST',
      headers,
      body: compressedData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
  }

  private async uploadSessionEvents(apiUrl: string, events: SessionEvent[]): Promise<void> {
    if (events.length === 0) return;

    this.debugLogger.log('session', 'upload-session-events-start', 'Starting session events upload', {
      eventsCount: events.length,
      eventsStructure: events.map((e, i) => ({
        index: i,
        type: e.type,
        hasSessionId: !!e.sessionId,
        sessionIdValue: e.sessionId || 'MISSING',
        timestamp: e.timestamp,
        dataKeys: Object.keys(e.data || {})
      }))
    });

    const sessionId = events[0].sessionId;
    this.debugLogger.log('session', 'session-id-extraction', 'Extracted session ID from first event', {
      sessionId,
      sessionIdType: typeof sessionId,
      sessionIdEmpty: !sessionId,
      firstEventType: events[0].type
    });

    const payload = {
      session_id: sessionId,
      events: events.map(event => ({
        event_type: event.type,
        data: event.data,
        timestamp: event.timestamp,
        session_id: event.sessionId
      }))
    };

    this.debugLogger.logSessionEventUpload(events, sessionId, payload);

    const { data: compressedData, compressed } = await compressData(payload);
    
    this.debugLogger.log('session', 'payload-compression', 'Payload compression completed', {
      originalSize: JSON.stringify(payload).length,
      compressedSize: (compressedData as any) instanceof ArrayBuffer ? (compressedData as unknown as ArrayBuffer).byteLength : (compressedData as unknown as string).length,
      compressed,
      payloadSessionId: payload.session_id,
      payloadEventsCount: payload.events.length,
      firstEventHasSessionId: payload.events[0]?.session_id ? true : false
    });
    
    const headers: Record<string, string> = {
      'X-API-Key': this.config.apiKey
    };
    
    if (compressed) {
      headers['Content-Type'] = 'application/octet-stream';
      headers['Content-Encoding'] = 'gzip';
      headers['X-Original-Content-Type'] = 'application/json';
    } else {
      headers['Content-Type'] = 'application/json';
    }

    this.debugLogger.logApiCall(
      'session-events-upload',
      `${apiUrl}/api/capture/session-event`,
      payload,
      undefined,
      undefined
    );

    const response = await fetch(`${apiUrl}/api/capture/session-event`, {
      method: 'POST',
      headers,
      body: compressedData
    });

    this.debugLogger.log('session', 'api-response', 'API response received', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error response');
      this.debugLogger.logError('session', 'upload-failed', new Error(`Upload failed: ${response.status}`), {
        status: response.status,
        statusText: response.statusText,
        errorResponse: errorText,
        payloadPreview: {
          session_id: payload.session_id,
          eventsCount: payload.events.length,
          firstEventKeys: payload.events[0] ? Object.keys(payload.events[0]) : []
        }
      });
      throw new Error(`Upload failed: ${response.status}`);
    }

    this.debugLogger.log('session', 'upload-success', 'Session events uploaded successfully', {
      eventsUploaded: events.length,
      sessionId: payload.session_id
    });
  }

  private async uploadNetworkEvents(apiUrl: string, events: NetworkEvent[]): Promise<void> {
    if (events.length === 0) return;

    this.debugLogger.log('network', 'upload-network-events-start', 'Starting network events upload', {
      eventsCount: events.length,
      eventsStructure: events.map((e, i) => ({
        index: i,
        method: e.method,
        url: e.url,
        hasSessionId: !!e.sessionId,
        sessionIdValue: e.sessionId || 'MISSING',
        statusCode: e.statusCode,
        timestamp: e.timestamp
      }))
    });

    // Use the first event's session ID (all events in batch should have same session)
    const sessionId = events[0].sessionId;
    this.debugLogger.log('network', 'session-id-extraction', 'Extracted session ID from first event', {
      sessionId,
      sessionIdType: typeof sessionId,
      sessionIdEmpty: !sessionId,
      firstEventMethod: events[0].method
    });

    const payload = {
      session_id: sessionId,
      events: events.map(event => ({
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
      }))
    };

    this.debugLogger.log('network', 'network-batch-payload', 'Network events batch payload created', {
      sessionId: payload.session_id,
      eventsCount: payload.events.length,
      allHaveSessionId: payload.events.every(e => !!e.session_id),
      sessionIds: payload.events.map(e => e.session_id)
    });

    const { data: compressedData, compressed } = await compressData(payload);
    
    this.debugLogger.log('network', 'payload-compression', 'Network payload compression completed', {
      originalSize: JSON.stringify(payload).length,
      compressedSize: (compressedData as any) instanceof ArrayBuffer ? (compressedData as unknown as ArrayBuffer).byteLength : (compressedData as unknown as string).length,
      compressed,
      payloadSessionId: payload.session_id,
      payloadEventsCount: payload.events.length
    });
    
    const headers: Record<string, string> = {
      'X-API-Key': this.config.apiKey
    };
    
    if (compressed) {
      headers['Content-Type'] = 'application/octet-stream';
      headers['Content-Encoding'] = 'gzip';
      headers['X-Original-Content-Type'] = 'application/json';
    } else {
      headers['Content-Type'] = 'application/json';
    }

    this.debugLogger.logApiCall(
      'network-events-upload',
      `${apiUrl}/api/capture/network-event`,
      payload,
      undefined,
      undefined
    );

    const response = await fetch(`${apiUrl}/api/capture/network-event`, {
      method: 'POST',
      headers,
      body: compressedData
    });

    this.debugLogger.log('network', 'api-response', 'Network API response received', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error response');
      this.debugLogger.logError('network', 'upload-failed', new Error(`Network upload failed: ${response.status}`), {
        status: response.status,
        statusText: response.statusText,
        errorResponse: errorText,
        payloadPreview: {
          session_id: payload.session_id,
          eventsCount: payload.events.length,
          firstEventKeys: payload.events[0] ? Object.keys(payload.events[0]) : []
        }
      });
      throw new Error(`Network upload failed: ${response.status}`);
    }

    this.debugLogger.log('network', 'upload-success', 'Network events uploaded successfully', {
      eventsUploaded: events.length,
      sessionId: payload.session_id
    });
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
