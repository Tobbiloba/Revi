'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RealTimeError, ErrorStreamFilters } from '../websocket/error-stream-client';
import { useWebSocketConnection } from './useWebSocketConnection';

export interface UseRealTimeErrorsOptions {
  projectId?: number;
  maxErrors?: number;
  autoConnect?: boolean;
  filters?: ErrorStreamFilters;
  enableNotifications?: boolean;
  onNewError?: (error: RealTimeError) => void;
  onErrorUpdated?: (error: RealTimeError) => void;
  onErrorResolved?: (errorId: number) => void;
}

export interface ErrorStreamState {
  errors: RealTimeError[];
  totalCount: number;
  isLoading: boolean;
  isPaused: boolean;
  newErrorsCount: number;
}

export const useRealTimeErrors = (options: UseRealTimeErrorsOptions = {}) => {
  const {
    projectId,
    maxErrors = 1000,
    autoConnect = true,
    filters = {},
    enableNotifications = true,
    onNewError,
    onErrorUpdated,
    onErrorResolved
  } = options;

  const [state, setState] = useState<ErrorStreamState>({
    errors: [],
    totalCount: 0,
    isLoading: false,
    isPaused: false,
    newErrorsCount: 0
  });

  const callbacksRef = useRef({ onNewError, onErrorUpdated, onErrorResolved });
  const filtersRef = useRef(filters);
  const notificationPermissionRef = useRef<NotificationPermission>('default');

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = { onNewError, onErrorUpdated, onErrorResolved };
  }, [onNewError, onErrorUpdated, onErrorResolved]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const {
    connectionStatus,
    isConnected,
    client,
    subscribeToProject,
    unsubscribeFromProject
  } = useWebSocketConnection({
    autoConnect,
    projectId,
    onConnectionChange: (status) => {
      setState(prev => ({ ...prev, isLoading: !status.connected }));
    }
  });

  // Request notification permission
  useEffect(() => {
    if (enableNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          notificationPermissionRef.current = permission;
        });
      } else {
        notificationPermissionRef.current = Notification.permission;
      }
    }
  }, [enableNotifications]);

  // Show notification for critical errors
  const showNotification = useCallback((error: RealTimeError) => {
    if (!enableNotifications || notificationPermissionRef.current !== 'granted') return;
    
    if (error.severity === 'critical' || error.severity === 'high') {
      new Notification(`${error.severity?.toUpperCase()} Error Detected`, {
        body: error.message.substring(0, 100),
        icon: '/favicon.ico',
        tag: `error-${error.id}`,
        requireInteraction: error.severity === 'critical'
      });
    }
  }, [enableNotifications]);

  // Filter errors based on current filters
  const shouldIncludeError = useCallback((error: RealTimeError): boolean => {
    const currentFilters = filtersRef.current;
    
    if (currentFilters.severity?.length && !currentFilters.severity.includes(error.severity || 'medium')) {
      return false;
    }
    
    if (currentFilters.timeRange) {
      const errorAge = Date.now() - new Date(error.timestamp).getTime();
      if (errorAge > currentFilters.timeRange * 60 * 1000) {
        return false;
      }
    }
    
    return true;
  }, []);

  // Handle new error
  const handleNewError = useCallback((error: RealTimeError) => {
    if (!shouldIncludeError(error)) return;

    setState(prev => {
      const newErrors = [error, ...prev.errors].slice(0, maxErrors);
      const newCount = prev.isPaused ? prev.newErrorsCount + 1 : 0;
      
      return {
        ...prev,
        errors: newErrors,
        totalCount: prev.totalCount + 1,
        newErrorsCount: newCount
      };
    });

    showNotification(error);
    callbacksRef.current.onNewError?.(error);
  }, [shouldIncludeError, maxErrors, showNotification]);

  // Handle error update
  const handleErrorUpdated = useCallback((updatedError: RealTimeError) => {
    setState(prev => ({
      ...prev,
      errors: prev.errors.map(error => 
        error.id === updatedError.id ? { ...updatedError, isNew: false } : error
      )
    }));

    callbacksRef.current.onErrorUpdated?.(updatedError);
  }, []);

  // Handle batch errors
  const handleBatchErrors = useCallback((errors: RealTimeError[]) => {
    const filteredErrors = errors.filter(shouldIncludeError);
    
    setState(prev => {
      const newErrors = [...filteredErrors, ...prev.errors].slice(0, maxErrors);
      const newCount = prev.isPaused ? prev.newErrorsCount + filteredErrors.length : 0;
      
      return {
        ...prev,
        errors: newErrors,
        totalCount: prev.totalCount + filteredErrors.length,
        newErrorsCount: newCount
      };
    });

    filteredErrors.forEach(error => {
      showNotification(error);
      callbacksRef.current.onNewError?.(error);
    });
  }, [shouldIncludeError, maxErrors, showNotification]);

  // Handle error resolution
  const handleErrorResolved = useCallback((errorId: number) => {
    setState(prev => ({
      ...prev,
      errors: prev.errors.filter(error => error.id !== errorId)
    }));

    callbacksRef.current.onErrorResolved?.(errorId);
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (!isConnected) return;

    client.on('error:new', handleNewError as (...args: unknown[]) => void);
    client.on('error:updated', handleErrorUpdated as (...args: unknown[]) => void);
    client.on('errors:batch', handleBatchErrors as (...args: unknown[]) => void);
    client.on('error:resolved', handleErrorResolved as (...args: unknown[]) => void);

    // Apply filters
    client.setFilters({ ...filters, projectId });

    return () => {
      client.off('error:new', handleNewError as (...args: unknown[]) => void);
      client.off('error:updated', handleErrorUpdated as (...args: unknown[]) => void);
      client.off('errors:batch', handleBatchErrors as (...args: unknown[]) => void);
      client.off('error:resolved', handleErrorResolved as (...args: unknown[]) => void);
    };
  }, [isConnected, client, handleNewError, handleErrorUpdated, handleBatchErrors, handleErrorResolved, filters, projectId]);

  // Control functions
  const pauseStream = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resumeStream = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: false, newErrorsCount: 0 }));
  }, []);

  const clearErrors = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      errors: [], 
      totalCount: 0, 
      newErrorsCount: 0 
    }));
  }, []);

  const updateFilters = useCallback((newFilters: ErrorStreamFilters) => {
    if (isConnected) {
      client.setFilters({ ...newFilters, projectId });
    }
    filtersRef.current = newFilters;
  }, [isConnected, client, projectId]);

  const markErrorAsRead = useCallback((errorId: number) => {
    setState(prev => ({
      ...prev,
      errors: prev.errors.map(error => 
        error.id === errorId ? { ...error, isNew: false } : error
      )
    }));
  }, []);

  return {
    ...state,
    connectionStatus,
    isConnected,
    pauseStream,
    resumeStream,
    clearErrors,
    updateFilters,
    markErrorAsRead,
    subscribeToProject,
    unsubscribeFromProject
  };
};