import React, { useState } from 'react';

interface Props {
  revi: any;
}

const ErrorDemo: React.FC<Props> = ({ revi }) => {
  const [status, setStatus] = useState<string>('');

  const throwError = () => {
    throw new Error('This is a test error thrown from React component!');
  };

  const promiseRejection = () => {
    Promise.reject(new Error('This is a test promise rejection from React!'));
    setStatus('Promise rejection triggered');
  };

  const captureMessage = () => {
    const id = revi.captureMessage('This is a test message from React', {
      level: 'info',
      tags: { source: 'react-demo', component: 'ErrorDemo' },
      extra: { timestamp: new Date().toISOString() }
    });
    setStatus(`Message captured with ID: ${id}`);
  };

  const captureException = () => {
    const error = new Error('This is a manually captured exception from React');
    const id = revi.captureException(error, {
      level: 'error',
      tags: { type: 'manual', component: 'ErrorDemo' },
      extra: { context: 'react-demo-page' }
    });
    setStatus(`Exception captured with ID: ${id}`);
  };

  return (
    <div className="demo-section">
      <h2>Error Capture</h2>
      <p>Test different types of error capture in React:</p>
      
      <div>
        <button className="button danger" onClick={throwError}>
          Throw Error
        </button>
        <button className="button danger" onClick={promiseRejection}>
          Promise Rejection
        </button>
        <button className="button" onClick={captureMessage}>
          Capture Message
        </button>
        <button className="button" onClick={captureException}>
          Capture Exception
        </button>
      </div>

      {status && (
        <div className="status success">
          {status}
        </div>
      )}
    </div>
  );
};

export default ErrorDemo;
