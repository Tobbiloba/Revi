// Comprehensive test script to verify complete monitoring functionality
const session_id = 'comprehensive_test_session_' + Date.now();
const api_key = 'revi_demo_api_key_for_testing_12345678901234567890';
const base_url = 'http://localhost:4000';

console.log('🔍 Running Comprehensive Monitoring Test');
console.log('Session ID:', session_id);

// Simulate realistic user journey
async function simulateUserJourney() {
  console.log('\n👤 Simulating realistic user journey...');
  
  const events = [];
  let eventCount = 0;
  
  // User loads page
  events.push(await captureEvent('pageview', {
    url: 'https://demo.revi.app/dashboard',
    title: 'Revi Dashboard',
    referrer: 'https://google.com/search?q=error+monitoring'
  }));
  
  // User clicks navigation
  await new Promise(resolve => setTimeout(resolve, 500));
  events.push(await captureEvent('click', {
    target: { tagName: 'A', textContent: 'Projects', href: '/projects' },
    coordinates: { x: 120, y: 45 }
  }));
  
  // Network request for projects
  await captureNetworkRequest('GET', 'https://api.demo.revi.app/projects', 200, 234);
  
  // User types in search
  await new Promise(resolve => setTimeout(resolve, 300));
  events.push(await captureEvent('input', {
    target: { tagName: 'INPUT', placeholder: 'Search projects...', value: 'demo' },
    inputType: 'text'
  }));
  
  // Search API call
  await captureNetworkRequest('GET', 'https://api.demo.revi.app/projects?search=demo', 200, 156);
  
  // User encounters an error
  await new Promise(resolve => setTimeout(resolve, 800));
  await captureError('ReferenceError: searchResults is not defined', `ReferenceError: searchResults is not defined
    at handleSearchResults (/dashboard/components/ProjectList.tsx:34:12)
    at handleSearch (/dashboard/components/SearchBar.tsx:28:5)
    at HTMLInputElement.<anonymous> (/dashboard/components/SearchBar.tsx:15:9)`);
  
  // User clicks refresh
  events.push(await captureEvent('click', {
    target: { tagName: 'BUTTON', textContent: 'Refresh', className: 'refresh-btn' },
    coordinates: { x: 89, y: 156 }
  }));
  
  // Retry API call
  await captureNetworkRequest('GET', 'https://api.demo.revi.app/projects', 200, 189);
  
  console.log(`✅ Simulated user journey complete (${events.filter(e => e).length} session events, 3 network events, 1 error)`);
  return events.filter(e => e).length > 0;
}

async function captureEvent(eventType, data) {
  try {
    const response = await fetch(`${base_url}/api/capture/session-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': api_key
      },
      body: JSON.stringify({
        session_id: session_id,
        event_type: eventType,
        data: data,
        timestamp: Date.now()
      })
    });
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error(`Failed to capture ${eventType} event:`, error);
    return false;
  }
}

async function captureNetworkRequest(method, url, statusCode, responseTime) {
  try {
    const response = await fetch(`${base_url}/api/capture/network-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': api_key
      },
      body: JSON.stringify({
        session_id: session_id,
        method: method,
        url: url,
        status_code: statusCode,
        response_time: responseTime,
        timestamp: Date.now(),
        request_data: {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Test)' }
        },
        response_data: {
          headers: { 'Content-Type': 'application/json' },
          body: method === 'GET' ? { data: 'mock response' } : null
        }
      })
    });
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error(`Failed to capture network request:`, error);
    return false;
  }
}

async function captureError(message, stackTrace) {
  try {
    const response = await fetch(`${base_url}/api/capture/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': api_key
      },
      body: JSON.stringify({
        message: message,
        stack_trace: stackTrace,
        url: 'https://demo.revi.app/dashboard',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        session_id: session_id,
        metadata: {
          component: 'ProjectList',
          action: 'handleSearchResults',
          browser: 'Chrome',
          version: '120.0.0.0',
          timestamp: Date.now()
        }
      })
    });
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Failed to capture error:', error);
    return false;
  }
}

// Test advanced session tracking features
async function testAdvancedTracking() {
  console.log('\n🧪 Testing advanced tracking features...');
  
  const results = [];
  
  // Test batch event capture
  console.log('   • Testing batch event capture...');
  const batchResponse = await fetch(`${base_url}/api/capture/session-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': api_key
    },
    body: JSON.stringify({
      events: [
        {
          session_id: session_id,
          event_type: 'scroll',
          data: { scrollTop: 150, scrollLeft: 0, target: 'body' },
          timestamp: Date.now()
        },
        {
          session_id: session_id,
          event_type: 'resize',
          data: { width: 1920, height: 1080, innerWidth: 1904, innerHeight: 966 },
          timestamp: Date.now() + 100
        }
      ]
    })
  });
  
  const batchResult = await batchResponse.json();
  results.push(batchResult.success);
  console.log(`   ✅ Batch capture: ${batchResult.success ? 'PASSED' : 'FAILED'}`);
  
  // Test performance event capture
  console.log('   • Testing performance event capture...');
  const perfResponse = await captureEvent('performance', {
    loadTime: 1234,
    domContentLoaded: 856,
    firstPaint: 945,
    firstContentfulPaint: 1120,
    largestContentfulPaint: 1456,
    cumulativeLayoutShift: 0.02,
    firstInputDelay: 23
  });
  
  results.push(perfResponse);
  console.log(`   ✅ Performance capture: ${perfResponse ? 'PASSED' : 'FAILED'}`);
  
  return results.every(r => r);
}

// Test error handling and edge cases
async function testErrorHandling() {
  console.log('\n🚨 Testing error handling and edge cases...');
  
  const results = [];
  
  // Test invalid API key
  console.log('   • Testing invalid API key handling...');
  const invalidKeyResponse = await fetch(`${base_url}/api/capture/error`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'invalid_key_12345'
    },
    body: JSON.stringify({
      message: 'Test error',
      stack_trace: 'Test stack trace',
      url: 'https://test.com',
      user_agent: 'Test UA',
      session_id: session_id
    })
  });
  
  const invalidKeyResult = await invalidKeyResponse.json();
  results.push(invalidKeyResponse.status === 401 && !invalidKeyResult.success);
  console.log(`   ✅ Invalid API key: ${invalidKeyResponse.status === 401 ? 'PASSED' : 'FAILED'}`);
  
  // Test missing API key
  console.log('   • Testing missing API key handling...');
  const noKeyResponse = await fetch(`${base_url}/api/capture/error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Test error',
      session_id: session_id
    })
  });
  
  results.push(noKeyResponse.status === 401);
  console.log(`   ✅ Missing API key: ${noKeyResponse.status === 401 ? 'PASSED' : 'FAILED'}`);
  
  return results.every(r => r);
}

// Main test runner
async function runComprehensiveTests() {
  try {
    const testResults = [];
    
    // Run all test suites
    testResults.push(await simulateUserJourney());
    await new Promise(resolve => setTimeout(resolve, 1000)); // Allow data processing
    
    testResults.push(await testAdvancedTracking());
    testResults.push(await testErrorHandling());
    
    // Verify final data integrity
    console.log('\n📊 Verifying final data integrity...');
    const timelineResponse = await fetch(`${base_url}/api/session/${session_id}/events`);
    const timeline = await timelineResponse.json();
    
    console.log(`   • Total events in session: ${timeline.events.length}`);
    console.log(`   • Event types: ${[...new Set(timeline.events.map(e => e.event_type || e.source))].join(', ')}`);
    
    const hasAllEventTypes = ['pageview', 'click', 'input', 'scroll', 'resize', 'performance', 'network_request', 'error']
      .every(type => timeline.events.some(e => (e.event_type || e.source) === type || e.source === type.replace('_request', '')));
    
    testResults.push(timeline.events.length >= 8);
    testResults.push(hasAllEventTypes);
    
    console.log(`   ✅ Event count: ${timeline.events.length >= 8 ? 'PASSED' : 'FAILED'}`);
    console.log(`   ✅ Event diversity: ${hasAllEventTypes ? 'PASSED' : 'FAILED'}`);
    
    // Final summary
    const passed = testResults.filter(r => r).length;
    const total = testResults.length;
    
    console.log('\n🏁 Comprehensive Test Summary:');
    console.log(`✅ Passed: ${passed}/${total} test suites`);
    
    if (passed === total) {
      console.log('🎉 All comprehensive tests passed! Full monitoring pipeline is working correctly.');
      console.log('📈 System is ready for production use.');
    } else {
      console.log('❌ Some comprehensive tests failed. Review the output above for details.');
    }
    
    return passed === total;
    
  } catch (error) {
    console.error('❌ Comprehensive test suite failed:', error);
    return false;
  }
}

// Run the comprehensive tests
if (typeof window === 'undefined') {
  runComprehensiveTests();
}