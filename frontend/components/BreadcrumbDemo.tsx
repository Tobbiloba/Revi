import React, { useState } from 'react';

interface Props {
  revi: any;
}

const BreadcrumbDemo: React.FC<Props> = ({ revi }) => {
  const [message, setMessage] = useState('User performed action in React');
  const [level, setLevel] = useState<'info' | 'warning' | 'error' | 'debug'>('info');
  const [status, setStatus] = useState<string>('');

  const handleAddBreadcrumb = () => {
    revi.addBreadcrumb({
      message,
      category: 'react-demo',
      level,
      data: { 
        timestamp: new Date().toISOString(),
        component: 'BreadcrumbDemo'
      }
    });
    
    setStatus(`Breadcrumb added: ${message}`);
    setTimeout(() => setStatus(''), 3000);
  };

  const addPredefinedBreadcrumbs = () => {
    const breadcrumbs = [
      { message: 'User navigated to page', level: 'info' as const },
      { message: 'API call initiated', level: 'info' as const },
      { message: 'Warning: Slow response detected', level: 'warning' as const },
      { message: 'User interaction completed', level: 'info' as const }
    ];

    breadcrumbs.forEach((breadcrumb, index) => {
      setTimeout(() => {
        revi.addBreadcrumb({
          message: breadcrumb.message,
          category: 'react-demo',
          level: breadcrumb.level,
          data: { sequence: index + 1 }
        });
      }, index * 500);
    });

    setStatus('Added 4 sequential breadcrumbs');
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <div className="demo-section">
      <h2>Breadcrumbs</h2>
      <p>Add custom breadcrumbs to track user actions:</p>
      
      <div className="input-group">
        <label>Breadcrumb Message:</label>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Breadcrumb message"
        />
      </div>

      <div className="input-group">
        <label>Level:</label>
        <select value={level} onChange={(e) => setLevel(e.target.value as any)}>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="debug">Debug</option>
        </select>
      </div>

      <div>
        <button className="button" onClick={handleAddBreadcrumb}>
          Add Breadcrumb
        </button>
        <button className="button" onClick={addPredefinedBreadcrumbs}>
          Add Sequence
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

export default BreadcrumbDemo;
