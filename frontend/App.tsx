import React, { useEffect, useState } from 'react';
import ReviErrorBoundary from './components/ReviErrorBoundary';
import ErrorDemo from './components/ErrorDemo';
import UserContextDemo from './components/UserContextDemo';
import BreadcrumbDemo from './components/BreadcrumbDemo';
import PerformanceDemo from './components/PerformanceDemo';
import NetworkDemo from './components/NetworkDemo';
import FormDemo from './components/FormDemo';
import SessionDemo from './components/SessionDemo';

// Mock Monitor class for demo purposes
class Monitor {
  private sessionId: string;
  
  constructor(config: any) {
    this.sessionId = 'demo-session-' + Math.random().toString(36).substr(2, 9);
    console.log('Demo Monitor initialized with config:', config);
  }

  getSessionId(): string {
    return this.sessionId;
  }

  captureException(error: Error, options?: any): string {
    const id = 'error-' + Math.random().toString(36).substr(2, 9);
    console.log('Demo: Captured exception', { error, options, id });
    return id;
  }

  captureMessage(message: string, options?: any): string {
    const id = 'message-' + Math.random().toString(36).substr(2, 9);
    console.log('Demo: Captured message', { message, options, id });
    return id;
  }

  addBreadcrumb(breadcrumb: any): void {
    console.log('Demo: Added breadcrumb', breadcrumb);
  }

  setUserContext(user: any): void {
    console.log('Demo: Set user context', user);
  }

  mark(name: string): void {
    console.log('Demo: Performance mark', name);
  }

  measure(name: string, start?: string, end?: string): number {
    const duration = Math.random() * 100;
    console.log('Demo: Performance measure', { name, start, end, duration });
    return duration;
  }

  getWebVitals(): any {
    return {
      lcp: Math.random() * 3000,
      fid: Math.random() * 100,
      cls: Math.random() * 0.5,
      fcp: Math.random() * 2000,
      ttfb: Math.random() * 500
    };
  }

  flush(): void {
    console.log('Demo: Flushed data');
  }

  endSession(): void {
    this.sessionId = 'demo-session-' + Math.random().toString(36).substr(2, 9);
    console.log('Demo: Ended session, new session:', this.sessionId);
  }
}

// Initialize Demo Monitor
const revi = new Monitor({
  apiKey: 'demo_' + Math.random().toString(36).substr(2, 32),
  environment: 'demo',
  debug: true,
  apiUrl: 'http://localhost:4000',
  sampleRate: 1.0,
  sessionSampleRate: 1.0,
  privacy: {
    maskInputs: true,
    maskPasswords: true
  },
  performance: {
    captureWebVitals: true,
    captureResourceTiming: true,
    captureNavigationTiming: true
  },
  replay: {
    enabled: true,
    maskAllInputs: false
  }
});

function App() {
  const [sessionId, setSessionId] = useState<string>('');
  const [initStatus, setInitStatus] = useState<{
    status: 'loading' | 'success' | 'error';
    message: string;
  }>({ status: 'loading', message: 'Initializing...' });

  useEffect(() => {
    try {
      const id = revi.getSessionId();
      setSessionId(id);
      setInitStatus({
        status: 'success',
        message: 'Demo Revi Monitor initialized successfully!'
      });

      // Add initial breadcrumb
      revi.addBreadcrumb({
        message: 'React app loaded',
        category: 'navigation',
        level: 'info'
      });
    } catch (error) {
      setInitStatus({
        status: 'error',
        message: `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }, []);

  return (
    <ReviErrorBoundary revi={revi}>
      <div className="container">
        <h1>Revi Monitor - React Demo</h1>
        <p>This demo shows how to integrate Revi Monitor into a React application.</p>
        <p><strong>Note:</strong> This is a demo using mock functionality. Check the browser console to see captured events.</p>

        <div className="demo-section">
          <h2>Initialization Status</h2>
          <div className={`status ${initStatus.status}`}>
            {initStatus.message}
          </div>
          <div>
            Session ID: <span className="code">{sessionId}</span>
          </div>
        </div>

        <ErrorDemo revi={revi} />
        <UserContextDemo revi={revi} />
        <BreadcrumbDemo revi={revi} />
        <PerformanceDemo revi={revi} />
        <NetworkDemo revi={revi} />
        <FormDemo revi={revi} />
        <SessionDemo revi={revi} onSessionChange={setSessionId} />
      </div>
    </ReviErrorBoundary>
  );
}

export default App;
