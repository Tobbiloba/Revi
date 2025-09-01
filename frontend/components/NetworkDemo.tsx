import React, { useState } from 'react';

interface Props {
  revi: any;
}

const NetworkDemo: React.FC<Props> = ({ revi }) => {
  const [networkResults, setNetworkResults] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const makeApiCall = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      const data = await response.json();
      
      setNetworkResults(`API call successful: "${data.title}"`);
      
      revi.addBreadcrumb({
        message: 'Successful API call',
        category: 'network',
        level: 'info',
        data: { url: response.url, status: response.status }
      });
    } catch (error) {
      setNetworkResults(`API call failed: ${error instanceof Error ? error.message : String(error)}`);
      
      revi.addBreadcrumb({
        message: 'Failed API call',
        category: 'network',
        level: 'error',
        data: { error: String(error) }
      });
    } finally {
      setLoading(false);
    }
  };

  const makeFailedRequest = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://httpstat.us/500');
      setNetworkResults(`Request returned: ${response.status} ${response.statusText}`);
    } catch (error) {
      setNetworkResults('Request failed as expected');
    } finally {
      setLoading(false);
    }
  };

  const makeMultipleRequests = async () => {
    setLoading(true);
    const urls = [
      'https://jsonplaceholder.typicode.com/posts/1',
      'https://jsonplaceholder.typicode.com/posts/2',
      'https://jsonplaceholder.typicode.com/posts/3'
    ];

    try {
      const promises = urls.map(url => fetch(url));
      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.ok).length;
      
      setNetworkResults(`Made ${urls.length} parallel requests, ${successCount} successful`);
      
      revi.addBreadcrumb({
        message: 'Multiple parallel requests completed',
        category: 'network',
        level: 'info',
        data: { total: urls.length, successful: successCount }
      });
    } catch (error) {
      setNetworkResults(`Parallel requests failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const makeSlowRequest = async () => {
    setLoading(true);
    try {
      // Using httpbin.org for slow responses
      const response = await fetch('https://httpbin.org/delay/2');
      const data = await response.json();
      
      setNetworkResults('Slow request completed successfully');
      
      revi.addBreadcrumb({
        message: 'Slow request completed',
        category: 'network',
        level: 'info',
        data: { duration: '2 seconds' }
      });
    } catch (error) {
      setNetworkResults(`Slow request failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="demo-section">
      <h2>Network Monitoring</h2>
      <p>Test network request monitoring in React:</p>
      
      <div>
        <button 
          className="button" 
          onClick={makeApiCall}
          disabled={loading}
        >
          Make API Call
        </button>
        <button 
          className="button" 
          onClick={makeFailedRequest}
          disabled={loading}
        >
          Make Failed Request
        </button>
        <button 
          className="button" 
          onClick={makeMultipleRequests}
          disabled={loading}
        >
          Multiple Requests
        </button>
        <button 
          className="button" 
          onClick={makeSlowRequest}
          disabled={loading}
        >
          Slow Request
        </button>
      </div>

      {loading && (
        <div className="status info">
          Making network request...
        </div>
      )}

      {networkResults && (
        <div className="status success">
          {networkResults}
        </div>
      )}
    </div>
  );
};

export default NetworkDemo;
