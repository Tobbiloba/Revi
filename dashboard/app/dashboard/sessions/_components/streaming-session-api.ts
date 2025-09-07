'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
// import { SessionEvent, ErrorEvent } from './session-replay-engine';

interface SessionEvent {
  id: string;
  type: string;
  timestamp: number;
  data?: unknown;
  sessionId?: string;
}

interface ErrorEvent {
  id: string;
  message: string;
  stack?: string;
  timestamp: number;
  data?: unknown;
  url?: string;
  sessionId?: string;
  metadata?: unknown;
}

export interface StreamingConfig {
  apiUrl: string;
  projectId: string;
  sessionId: string;
  apiKey: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  bufferSize?: number;
}

export interface StreamingSessionData {
  events: SessionEvent[];
  errors: ErrorEvent[];
  isLive: boolean;
  lastEventTime: number;
  totalEvents: number;
  bufferedEvents: number;
}

export type StreamingEventHandler = (data: StreamingSessionData) => void;

/**
 * Real-time session streaming API client with WebSocket and Server-Sent Events support
 */
export class StreamingSessionAPI {
  private config: StreamingConfig;
  private eventSource: EventSource | null = null;
  private websocket: WebSocket | null = null;
  private eventBuffer: SessionEvent[] = [];
  private errorBuffer: ErrorEvent[] = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Set<StreamingEventHandler> = new Set();
  private lastHeartbeat = 0;
  private connectionType: 'websocket' | 'sse' | 'polling' = 'websocket';

  constructor(config: StreamingConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      bufferSize: 1000,
      ...config
    };
  }

  /**
   * Start streaming session data
   */
  async connect(): Promise<void> {
    try {
      // Try WebSocket first, then fallback to SSE, then polling
      if (await this.tryWebSocket()) {
        this.connectionType = 'websocket';
      } else if (await this.tryServerSentEvents()) {
        this.connectionType = 'sse';
      } else {
        this.connectionType = 'polling';
        this.startPolling();
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      
    } catch (error) {
      console.error('Failed to establish streaming connection:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from streaming API
   */
  disconnect(): void {
    this.isConnected = false;
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
  }

  /**
   * Add event handler for streaming updates
   */
  onUpdate(handler: StreamingEventHandler): () => void {
    this.eventHandlers.add(handler);
    
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Get current streaming data
   */
  getCurrentData(): StreamingSessionData {
    return {
      events: [...this.eventBuffer],
      errors: [...this.errorBuffer],
      isLive: this.isConnected,
      lastEventTime: Math.max(
        ...this.eventBuffer.map(e => e.timestamp),
        ...this.errorBuffer.map(e => e.timestamp),
        0
      ),
      totalEvents: this.eventBuffer.length + this.errorBuffer.length,
      bufferedEvents: Math.min(this.eventBuffer.length + this.errorBuffer.length, this.config.bufferSize!)
    };
  }

  /**
   * Try WebSocket connection
   */
  private async tryWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const wsUrl = `${this.config.apiUrl.replace(/^http/, 'ws')}/api/stream/session/${this.config.sessionId}`;
        const websocket = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          websocket.close();
          resolve(false);
        }, 5000);

        websocket.onopen = () => {
          clearTimeout(timeout);
          
          // Send authentication
          websocket.send(JSON.stringify({
            type: 'auth',
            apiKey: this.config.apiKey,
            projectId: this.config.projectId
          }));
          
          this.websocket = websocket;
          this.setupWebSocketHandlers();
          resolve(true);
        };

        websocket.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
        
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Try Server-Sent Events connection
   */
  private async tryServerSentEvents(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const sseUrl = `${this.config.apiUrl}/api/stream/session/${this.config.sessionId}/events?` +
          `apiKey=${encodeURIComponent(this.config.apiKey)}&projectId=${encodeURIComponent(this.config.projectId)}`;
        
        const eventSource = new EventSource(sseUrl);
        
        const timeout = setTimeout(() => {
          eventSource.close();
          resolve(false);
        }, 5000);

        eventSource.onopen = () => {
          clearTimeout(timeout);
          this.eventSource = eventSource;
          this.setupSSEHandlers();
          resolve(true);
        };

        eventSource.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
        
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleStreamingMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.websocket.onclose = () => {
      this.isConnected = false;
      this.scheduleReconnect();
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  /**
   * Setup Server-Sent Events handlers
   */
  private setupSSEHandlers(): void {
    if (!this.eventSource) return;

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleStreamingMessage(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    this.eventSource.addEventListener('session-event', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        this.handleStreamingMessage({ type: 'session-event', data });
      } catch (error) {
        console.error('Failed to parse SSE session event:', error);
      }
    });

    this.eventSource.addEventListener('error-event', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        this.handleStreamingMessage({ type: 'error-event', data });
      } catch (error) {
        console.error('Failed to parse SSE error event:', error);
      }
    });

    this.eventSource.onerror = () => {
      this.isConnected = false;
      this.scheduleReconnect();
    };
  }

  /**
   * Start polling fallback
   */
  private startPolling(): void {
    let lastEventId = 0;
    
    const poll = async () => {
      if (!this.isConnected) return;
      
      try {
        const response = await fetch(
          `${this.config.apiUrl}/api/session/${this.config.sessionId}/events/poll?` +
          `since=${lastEventId}&apiKey=${encodeURIComponent(this.config.apiKey)}`,
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          if (data.events && data.events.length > 0) {
            data.events.forEach((event: { type: string; id?: number }) => {
              this.handleStreamingMessage({
                type: event.type === 'error' ? 'error-event' : 'session-event',
                data: event
              });
              lastEventId = Math.max(lastEventId, event.id || 0);
            });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
      
      // Schedule next poll
      setTimeout(poll, 2000);
    };
    
    poll();
  }

  /**
   * Handle incoming streaming messages
   */
  private handleStreamingMessage(message: { type: string; data: unknown }): void {
    this.lastHeartbeat = Date.now();
    
    switch (message.type) {
      case 'session-event':
        this.addSessionEvent(message.data as Record<string, unknown>);
        break;
        
      case 'error-event':
        this.addErrorEvent(message.data as Record<string, unknown>);
        break;
        
      case 'heartbeat':
        // Keep connection alive
        break;
        
      case 'session-ended':
        this.isConnected = false;
        this.notifyHandlers();
        break;
        
      default:
        console.warn('Unknown streaming message type:', message.type);
    }
  }

  /**
   * Add session event to buffer
   */
  private addSessionEvent(eventData: Record<string, unknown>): void {
    const event: SessionEvent = {
      id: String(eventData.id || `${Date.now()}-${Math.random()}`),
      type: String(eventData.event_type || eventData.type || 'unknown'),
      timestamp: Number(eventData.timestamp) || Date.now(),
      data: eventData.data || eventData,
      sessionId: this.config.sessionId
    };

    this.eventBuffer.push(event);
    
    // Maintain buffer size
    if (this.eventBuffer.length > this.config.bufferSize!) {
      this.eventBuffer = this.eventBuffer.slice(-this.config.bufferSize!);
    }
    
    this.notifyHandlers();
  }

  /**
   * Add error event to buffer
   */
  private addErrorEvent(errorData: Record<string, unknown>): void {
    const error: ErrorEvent = {
      id: String(errorData.id || `error-${Date.now()}-${Math.random()}`),
      message: String(errorData.message || 'Unknown error'),
      stack: String(errorData.stack_trace || errorData.stack || ''),
      timestamp: Number(errorData.timestamp) || Date.now(),
      url: String(errorData.url || ''),
      sessionId: this.config.sessionId,
      metadata: errorData.metadata || {}
    };

    this.errorBuffer.push(error);
    
    // Maintain buffer size  
    if (this.errorBuffer.length > this.config.bufferSize!) {
      this.errorBuffer = this.errorBuffer.slice(-this.config.bufferSize!);
    }
    
    this.notifyHandlers();
  }

  /**
   * Notify all event handlers
   */
  private notifyHandlers(): void {
    const data = this.getCurrentData();
    this.eventHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in streaming event handler:', error);
      }
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.warn('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.lastHeartbeat = Date.now();
    
    const checkHeartbeat = () => {
      const now = Date.now();
      if (now - this.lastHeartbeat > 30000) { // 30 seconds timeout
        console.warn('Heartbeat timeout, reconnecting...');
        this.isConnected = false;
        this.scheduleReconnect();
        return;
      }
      
      if (this.isConnected) {
        setTimeout(checkHeartbeat, 5000);
      }
    };
    
    setTimeout(checkHeartbeat, 5000);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    this.lastHeartbeat = 0;
  }

  /**
   * Get connection stats
   */
  getConnectionStats() {
    return {
      isConnected: this.isConnected,
      connectionType: this.connectionType,
      reconnectAttempts: this.reconnectAttempts,
      bufferedEvents: this.eventBuffer.length + this.errorBuffer.length,
      lastHeartbeat: this.lastHeartbeat,
      uptime: this.isConnected ? Date.now() - this.lastHeartbeat : 0
    };
  }
}

/**
 * React hook for streaming session data
 */
export function useStreamingSession(config: StreamingConfig) {
  const [streamingData, setStreamingData] = useState<StreamingSessionData>({
    events: [],
    errors: [],
    isLive: false,
    lastEventTime: 0,
    totalEvents: 0,
    bufferedEvents: 0
  });
  
  const [connectionStats, setConnectionStats] = useState({
    isConnected: false,
    connectionType: 'websocket' as 'websocket' | 'sse' | 'polling',
    reconnectAttempts: 0,
    bufferedEvents: 0,
    lastHeartbeat: 0,
    uptime: 0
  });
  
  const apiRef = useRef<StreamingSessionAPI | null>(null);

  const connect = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.disconnect();
    }
  }, []);

  useEffect(() => {
    apiRef.current = new StreamingSessionAPI(config);
    
    const unsubscribe = apiRef.current.onUpdate((data) => {
      setStreamingData(data);
      setConnectionStats(apiRef.current!.getConnectionStats());
    });

    // Auto-connect
    apiRef.current.connect();

    return () => {
      unsubscribe();
      apiRef.current?.disconnect();
    };
  }, [config.sessionId, config.projectId, config.apiKey]);

  return {
    streamingData,
    connectionStats,
    connect,
    disconnect,
    isLive: streamingData.isLive
  };
}