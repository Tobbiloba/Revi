import React, { useEffect, useState } from 'react';
import ReviErrorBoundary from './components/ReviErrorBoundary';
import ErrorDemo from './components/ErrorDemo';
import UserContextDemo from './components/UserContextDemo';
import BreadcrumbDemo from './components/BreadcrumbDemo';
import PerformanceDemo from './components/PerformanceDemo';
import NetworkDemo from './components/NetworkDemo';
import FormDemo from './components/FormDemo';
import SessionDemo from './components/SessionDemo';
import { Monitor } from './revi-monitor/dist/index.esm.js';

// Initialize Demo Monitor  
const revi = new Monitor({
  apiKey: 'revi_demo_api_key_for_testing_12345678901234567890',
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
