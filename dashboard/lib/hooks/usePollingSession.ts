'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { SessionPollingClient } from '../polling-client';

interface PollingEvent {
  id: number;
  type: string;
  timestamp: number;
  data: unknown;
}

interface PollingSessionData {
  events: PollingEvent[];
  errors: PollingEvent[];
  isLive: boolean;
  lastEventTime: number;
  totalEvents: number;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export function usePollingSession(sessionId: string, apiKey: string, baseUrl?: string) {
  const [sessionData, setSessionData] = useState<PollingSessionData>({
    events: [],
    errors: [],
    isLive: true,
    lastEventTime: 0,
    totalEvents: 0,
    connectionStatus: 'connecting'
  });

  const pollingClientRef = useRef<SessionPollingClient | null>(null);
  const mountedRef = useRef(true);

  const updateSessionData = useCallback((newEvents: PollingEvent[]) => {
    if (!mountedRef.current) return;
    
    setSessionData(prev => {
      const allEvents = [...prev.events, ...newEvents];
      const errors = newEvents.filter(event => event.type === 'error');
      const allErrors = [...prev.errors, ...errors];
      
      const lastEventTime = newEvents.length > 0 
        ? Math.max(...newEvents.map(e => e.timestamp))
        : prev.lastEventTime;

      return {
        events: allEvents,
        errors: allErrors,
        isLive: true, // Assume live while polling
        lastEventTime,
        totalEvents: allEvents.length,
        connectionStatus: 'connected'
      };
    });
  }, []);

  useEffect(() => {
    if (!sessionId || !apiKey) return;

    console.log(`[usePollingSession] Starting polling for session ${sessionId}`);
    setSessionData(prev => ({ ...prev, connectionStatus: 'connecting' }));

    // Create polling client
    pollingClientRef.current = new SessionPollingClient(
      sessionId, 
      apiKey, 
      baseUrl || 'http://localhost:4000'
    );

    // Subscribe to events
    const unsubscribe = pollingClientRef.current.onEvents(updateSessionData);

    // Start polling
    pollingClientRef.current.startPolling(2000); // Poll every 2 seconds

    setSessionData(prev => ({ ...prev, connectionStatus: 'connected' }));

    // Cleanup on unmount
    return () => {
      console.log(`[usePollingSession] Cleanup for session ${sessionId}`);
      mountedRef.current = false;
      unsubscribe();
      pollingClientRef.current?.stopPolling();
      pollingClientRef.current = null;
    };
  }, [sessionId, apiKey, baseUrl, updateSessionData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resetPolling = useCallback(() => {
    if (pollingClientRef.current) {
      pollingClientRef.current.reset();
      setSessionData(prev => ({
        ...prev,
        events: [],
        errors: [],
        totalEvents: 0,
        lastEventTime: 0
      }));
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingClientRef.current) {
      pollingClientRef.current.stopPolling();
      setSessionData(prev => ({ ...prev, connectionStatus: 'disconnected' }));
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingClientRef.current && !pollingClientRef.current.isActive()) {
      pollingClientRef.current.startPolling();
      setSessionData(prev => ({ ...prev, connectionStatus: 'connected' }));
    }
  }, []);

  return {
    sessionData,
    resetPolling,
    stopPolling,
    startPolling,
    isPolling: pollingClientRef.current?.isActive() ?? false
  };
}