'use client';

import { Socket } from 'socket.io-client';
import { ErrorWithSession } from '../revi-api';

export interface RealTimeError extends ErrorWithSession {
  isNew?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorStreamFilters {
  projectId?: number;
  severity?: string[];
  errorType?: string[];
  timeRange?: number; // minutes
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  lastConnected?: Date;
  connectionCount: number;
}

export class ErrorStreamClient {
  private socket: Socket | null = null;
  private connectionStatus: ConnectionStatus = {
    connected: false,
    reconnecting: false,
    connectionCount: 0
  };
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  constructor(private baseUrl: string) {
    this.initializeSocket();
  }

  private initializeSocket() {
    // DISABLED: Socket.io initialization disabled due to backend not supporting Socket.io
    // Backend uses custom streaming endpoints instead
    console.log('ErrorStreamClient: Socket.io initialization disabled');
    
    // Set socket to null to prevent connection attempts
    this.socket = null;
    return;
    
    /* ORIGINAL CODE - DISABLED
    this.socket = io(this.baseUrl, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.setupSocketListeners();
    */
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.connectionStatus = {
        connected: true,
        reconnecting: false,
        lastConnected: new Date(),
        connectionCount: this.connectionStatus.connectionCount + 1
      };
      this.reconnectAttempts = 0;
      this.emit('connection:status', this.connectionStatus);
      console.log('ErrorStream: Connected to WebSocket server');
    });

    this.socket.on('disconnect', (reason) => {
      this.connectionStatus.connected = false;
      this.emit('connection:status', this.connectionStatus);
      console.log('ErrorStream: Disconnected from WebSocket server:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('ErrorStream: Connection error:', error);
      this.connectionStatus.reconnecting = true;
      this.emit('connection:status', this.connectionStatus);
      this.emit('connection:error', error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('ErrorStream: Reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      this.connectionStatus.reconnecting = true;
      this.emit('connection:status', this.connectionStatus);
      console.log('ErrorStream: Reconnect attempt', attemptNumber);
    });

    // Error stream events
    this.socket.on('error:new', (error: RealTimeError) => {
      this.emit('error:new', { ...error, isNew: true });
    });

    this.socket.on('error:updated', (error: RealTimeError) => {
      this.emit('error:updated', error);
    });

    this.socket.on('errors:batch', (errors: RealTimeError[]) => {
      this.emit('errors:batch', errors);
    });

    this.socket.on('error:resolved', (errorId: number) => {
      this.emit('error:resolved', errorId);
    });
  }

  connect(projectId?: number) {
    console.log(projectId)
    // DISABLED: Socket.io connection temporarily disabled due to backend not supporting it
    // Backend uses custom streaming endpoints instead of Socket.io
    console.log('ErrorStreamClient: Socket.io connection disabled - using polling fallback');
    
    // Set connected to false to avoid trying WebSocket connections
    this.connectionStatus = {
      connected: false,
      reconnecting: false,
      lastConnected: undefined,
      connectionCount: 0
    };
    this.emit('connection:status', this.connectionStatus);
    
    return;
    
    /* ORIGINAL CODE - DISABLED
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
      
      if (projectId) {
        this.socket.emit('subscribe:project', projectId);
      }
    }
    */
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  subscribeToProject(projectId: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe:project', projectId);
    }
  }

  unsubscribeFromProject(projectId: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe:project', projectId);
    }
  }

  setFilters(filters: ErrorStreamFilters) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('filters:update', filters);
    }
  }

  // Event listener management
  on(event: string, callback: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback?: (...args: unknown[]) => void) {
    if (!callback) {
      this.listeners.delete(event);
    } else {
      this.listeners.get(event)?.delete(callback);
    }
  }

  private emit(event: string, data?: unknown) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  isConnected(): boolean {
    return this.connectionStatus.connected;
  }

  destroy() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }
}

// Singleton instance
let errorStreamClient: ErrorStreamClient | null = null;

export const getErrorStreamClient = (baseUrl?: string): ErrorStreamClient => {
  if (!errorStreamClient) {
    const url = baseUrl || process.env.NEXT_PUBLIC_REVI_WEBSOCKET_URL || 'ws://localhost:4000';
    errorStreamClient = new ErrorStreamClient(url);
  }
  return errorStreamClient;
};

export const destroyErrorStreamClient = () => {
  if (errorStreamClient) {
    errorStreamClient.destroy();
    errorStreamClient = null;
  }
};