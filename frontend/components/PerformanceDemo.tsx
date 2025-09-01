import React, { useState } from 'react';

interface Props {
  revi: any;
}

const PerformanceDemo: React.FC<Props> = ({ revi }) => {
  const [results, setResults] = useState<string>('');
  const [webVitals, setWebVitals] = useState<any>({});

  const runPerformanceTest = () => {
    const testName = `react-perf-test-${Date.now()}`;
    revi.mark(`${testName}-start`);
    
    // Simulate some computational work
    const start = Date.now();
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += Math.random();
    }
    
    revi.mark(`${testName}-end`);
    const duration = revi.measure(testName, `${testName}-start`, `${testName}-end`);
    
    const actualDuration = Date.now() - start;
    setResults(`Performance test completed in ${duration || actualDuration}ms (computed ${sum.toFixed(2)})`);
  };

  const showWebVitals = () => {
    const vitals = revi.getWebVitals();
    setWebVitals(vitals);
  };

  const heavyComponentTest = () => {
    const start = performance.now();
    revi.mark('heavy-component-start');
    
    // Simulate heavy rendering
    for (let i = 0; i < 100000; i++) {
      document.createElement('div');
    }
    
    revi.mark('heavy-component-end');
    const duration = revi.measure('heavy-component-render', 'heavy-component-start', 'heavy-component-end');
    const actualDuration = performance.now() - start;
    
    setResults(`Heavy component test: ${duration || actualDuration.toFixed(2)}ms`);
  };

  return (
    <div className="demo-section">
      <h2>Performance Monitoring</h2>
      <p>Test performance monitoring features in React:</p>
      
      <div>
        <button className="button" onClick={runPerformanceTest}>
          Run Performance Test
        </button>
        <button className="button" onClick={heavyComponentTest}>
          Heavy Component Test
        </button>
        <button className="button" onClick={showWebVitals}>
          Show Web Vitals
        </button>
      </div>

      {results && (
        <div className="status success">
          {results}
        </div>
      )}

      {Object.keys(webVitals).length > 0 && (
        <div>
          <h3>Core Web Vitals:</h3>
          <div className="metrics">
            {Object.entries(webVitals).map(([key, value]) => (
              <div key={key} className="metric">
                <div className="metric-value">
                  {value ? Math.round(value as number) + 'ms' : 'N/A'}
                </div>
                <div className="metric-label">{key.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceDemo;
