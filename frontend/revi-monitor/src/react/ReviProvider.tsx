'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Monitor } from '../monitor';
import type { ReviConfig } from '../types';

interface ReviContextType {
  monitor: Monitor | null;
  isInitialized: boolean;
  sessionId: string;
}

const ReviContext = createContext<ReviContextType>({
  monitor: null,
  isInitialized: false,
  sessionId: ''
});

export const useRevi = () => useContext(ReviContext);

export interface ReviProviderProps {
  children: React.ReactNode;
  apiKey: string;
  apiUrl?: string;
  environment?: 'development' | 'production' | 'staging';
  debug?: boolean;
  userId?: string;
  userEmail?: string;
  sampleRate?: number;
  sessionSampleRate?: number;
}

export function ReviProvider({
  children,
  apiKey,
  apiUrl = 'https://api.revi.dev',
  environment = 'production',
  debug = false,
  userId,
  userEmail,
  sampleRate = 1.0,
  sessionSampleRate = 1.0
}: ReviProviderProps) {
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const initRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization
    if (initRef.current) return;
    initRef.current = true;

    if (typeof window === 'undefined') return;

    try {
      const config: ReviConfig = {
        apiKey,
        apiUrl,
        environment,
        debug,
        userId,
        sampleRate,
        sessionSampleRate,
        // Smart defaults that work for most applications
        maxBreadcrumbs: 50,
        privacy: {
          maskInputs: true,
          maskPasswords: true,
          maskCreditCards: true
        },
        performance: {
          captureWebVitals: true,
          captureResourceTiming: false,
          captureNavigationTiming: true
        },
        replay: {
          enabled: true,
          maskAllInputs: false,
          maskAllText: false
        }
      };

      const reviMonitor = new Monitor(config);
      setMonitor(reviMonitor);
      setSessionId(reviMonitor.getSessionId());
      setIsInitialized(true);

      // Set user context if provided
      if (userId || userEmail) {
        reviMonitor.setUserContext({
          id: userId,
          email: userEmail
        });
      }

      if (debug) {
        console.log('Revi: Initialized successfully', { sessionId: reviMonitor.getSessionId() });
      }

    } catch (error) {
      if (debug) {
        console.error('Revi: Failed to initialize', error);
      }
    }

    // Cleanup on unmount
    return () => {
      if (monitor) {
        monitor.destroy();
      }
    };
  }, [apiKey, apiUrl, environment, debug, userId, userEmail, sampleRate, sessionSampleRate]);

  const contextValue: ReviContextType = {
    monitor,
    isInitialized,
    sessionId
  };

  return (
    <ReviContext.Provider value={contextValue}>
      {children}
    </ReviContext.Provider>
  );
}

export default ReviProvider;