import React, { useState } from 'react';

interface Props {
  revi: any;
  onSessionChange: (sessionId: string) => void;
}

const SessionDemo: React.FC<Props> = ({ revi, onSessionChange }) => {
  const [status, setStatus] = useState<string>('');

  const flushData = () => {
    revi.flush();
    setStatus('Data flushed to server');
    setTimeout(() => setStatus(''), 3000);
  };

  const endSession = () => {
    revi.endSession();
    const newSessionId = revi.getSessionId();
    onSessionChange(newSessionId);
    setStatus('Session ended, new session started');
    setTimeout(() => setStatus(''), 3000);
  };

  const getSessionInfo = () => {
    const sessionId = revi.getSessionId();
    const vitals = revi.getWebVitals();
    
    setStatus(`Session: ${sessionId.slice(0, 8)}... | Web Vitals: ${Object.keys(vitals).length} metrics`);
    setTimeout(() => setStatus(''), 5000);
  };

  const simulateUserActivity = () => {
    const activities = [
      'Clicked navigation menu',
      'Scrolled to section',
      'Opened modal dialog',
      'Submitted form',
      'Downloaded file'
    ];

    activities.forEach((activity, index) => {
      setTimeout(() => {
        revi.addBreadcrumb({
          message: activity,
          category: 'user-activity',
          level: 'info',
          data: { 
            sequence: index + 1,
            component: 'SessionDemo'
          }
        });
      }, index * 1000);
    });

    setStatus('Simulating user activity (5 actions over 5 seconds)');
    setTimeout(() => setStatus(''), 6000);
  };

  return (
    <div className="demo-section">
      <h2>Session Management</h2>
      <p>Manage session state and data:</p>
      
      <div>
        <button className="button" onClick={flushData}>
          Flush Data
        </button>
        <button className="button" onClick={endSession}>
          End Session
        </button>
        <button className="button" onClick={getSessionInfo}>
          Get Session Info
        </button>
        <button className="button" onClick={simulateUserActivity}>
          Simulate Activity
        </button>
      </div>

      {status && (
        <div className="status info">
          {status}
        </div>
      )}
    </div>
  );
};

export default SessionDemo;
