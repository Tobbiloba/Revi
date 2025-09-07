'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getErrorStreamClient, ConnectionStatus, destroyErrorStreamClient } from '../websocket/error-stream-client';

export interface UseWebSocketConnectionOptions {
  autoConnect?: boolean;
  projectId?: number;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
}

export const useWebSocketConnection = (options: UseWebSocketConnectionOptions = {}) => {
  const {
    autoConnect = true,
    projectId,
    onConnectionChange,
    onError
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
    connectionCount: 0
  });

  const clientRef = useRef(getErrorStreamClient());
  const statusCallbackRef = useRef(onConnectionChange);
  const errorCallbackRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    statusCallbackRef.current = onConnectionChange;
    errorCallbackRef.current = onError;
  }, [onConnectionChange, onError]);

  const handleConnectionStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    statusCallbackRef.current?.(status);
  }, []);

  const handleConnectionError = useCallback((error: Error) => {
    errorCallbackRef.current?.(error);
  }, []);

  const connect = useCallback(() => {
    const client = clientRef.current;
    client.connect(projectId);
  }, [projectId]);

  const disconnect = useCallback(() => {
    const client = clientRef.current;
    client.disconnect();
  }, []);

  const subscribeToProject = useCallback((projectId: number) => {
    const client = clientRef.current;
    client.subscribeToProject(projectId);
  }, []);

  const unsubscribeFromProject = useCallback((projectId: number) => {
    const client = clientRef.current;
    client.unsubscribeFromProject(projectId);
  }, []);

  // Setup event listeners
  useEffect(() => {
    const client = clientRef.current;
    
    client.on('connection:status', handleConnectionStatus as (...args: unknown[]) => void);
    client.on('connection:error', handleConnectionError as (...args: unknown[]) => void);

    // Get initial status
    setConnectionStatus(client.getConnectionStatus());

    return () => {
      client.off('connection:status', handleConnectionStatus as (...args: unknown[]) => void);
      client.off('connection:error', handleConnectionError as (...args: unknown[]) => void);
    };
  }, [handleConnectionStatus, handleConnectionError]);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && !connectionStatus.connected) {
      connect();
    }
  }, [autoConnect, connectionStatus.connected, connect]);

  // Subscribe to project when projectId changes
  useEffect(() => {
    if (projectId && connectionStatus.connected) {
      subscribeToProject(projectId);
    }
  }, [projectId, connectionStatus.connected, subscribeToProject]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't destroy the client on unmount as it might be used by other components
      // Only disconnect if this is the last component using it
    };
  }, []);

  return {
    connectionStatus,
    isConnected: connectionStatus.connected,
    isReconnecting: connectionStatus.reconnecting,
    connect,
    disconnect,
    subscribeToProject,
    unsubscribeFromProject,
    client: clientRef.current
  };
};

// Hook for managing global WebSocket lifecycle
export const useWebSocketLifecycle = () => {
  const cleanup = useCallback(() => {
    destroyErrorStreamClient();
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { cleanup };
};