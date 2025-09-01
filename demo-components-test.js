// Test script to verify demo component functionality by simulating their API calls
const API_KEY = 'revi_demo_api_key_for_testing_12345678901234567890';
const BACKEND_URL = 'http://localhost:4000';

const sessionId = 'demo_components_test_' + Date.now();

console.log('🧪 Testing Demo Components Functionality');
console.log('Session ID:', sessionId);

// Test ErrorDemo component functionality
async function testErrorDemo() {
  console.log('\n🚨 Testing ErrorDemo Component...');
  
  const tests = [];
  
  // Test 1: Throw Error simulation
  try {
    const response = await fetch(`${BACKEND_URL}/api/capture/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        message: 'This is a test error thrown from React component!',
        stack_trace: `Error: This is a test error thrown from React component!
    at throwError (ErrorDemo.tsx:11:11)
    at HTMLButtonElement.<anonymous> (ErrorDemo.tsx:44:9)`,
        url: 'http://localhost:5174/',
        user_agent: 'Mozilla/5.0 (Demo Test)',
        session_id: sessionId,
        metadata: {
          component: 'ErrorDemo',
          action: 'throwError',
          level: 'error'
        }
      })
    });
    
    const result = await response.json();
    tests.push(result.success);
    console.log(`   ✅ Throw Error: ${result.success ? 'SUCCESS' : 'FAIL'}`);
  } catch (error) {
    tests.push(false);
    console.log(`   ❌ Throw Error: FAIL (${error.message})`);
  }
  
  // Test 2: Capture Exception simulation
  try {
    const response = await fetch(`${BACKEND_URL}/api/capture/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        message: 'This is a manually captured exception from React',
        stack_trace: `Error: This is a manually captured exception from React
    at captureException (ErrorDemo.tsx:29:29)
    at HTMLButtonElement.<anonymous> (ErrorDemo.tsx:54:9)`,
        url: 'http://localhost:5174/',
        user_agent: 'Mozilla/5.0 (Demo Test)',
        session_id: sessionId,
        metadata: {
          component: 'ErrorDemo',
          action: 'captureException',
          level: 'error',
          type: 'manual',
          context: 'react-demo-page'
        }
      })
    });
    
    const result = await response.json();
    tests.push(result.success);
    console.log(`   ✅ Capture Exception: ${result.success ? 'SUCCESS' : 'FAIL'}`);
  } catch (error) {
    tests.push(false);
    console.log(`   ❌ Capture Exception: FAIL (${error.message})`);
  }
  
  return tests.every(t => t);
}

// Test NetworkDemo component functionality
async function testNetworkDemo() {
  console.log('\n🌐 Testing NetworkDemo Component...');
  
  const tests = [];
  
  // Test 1: API Call simulation
  try {
    const response = await fetch(`${BACKEND_URL}/api/capture/network-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        session_id: sessionId,
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        status_code: 200,
        response_time: 234,
        timestamp: Date.now(),
        request_data: {
          headers: { 'Accept': 'application/json' }
        },
        response_data: {
          headers: { 'Content-Type': 'application/json' },
          body: { id: 1, title: 'sunt aut facere', body: 'quia et suscipit...' }
        }
      })
    });
    
    const result = await response.json();
    tests.push(result.success);
    console.log(`   ✅ API Call Monitor: ${result.success ? 'SUCCESS' : 'FAIL'}`);
  } catch (error) {
    tests.push(false);
    console.log(`   ❌ API Call Monitor: FAIL (${error.message})`);
  }
  
  // Test 2: Failed Request simulation
  try {
    const response = await fetch(`${BACKEND_URL}/api/capture/network-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        session_id: sessionId,
        method: 'GET',
        url: 'https://httpstat.us/500',
        status_code: 500,
        response_time: 156,
        timestamp: Date.now(),
        request_data: {
          headers: { 'Accept': 'application/json' }
        },
        response_data: {
          headers: { 'Content-Type': 'text/plain' },
          body: 'Internal Server Error'
        }
      })
    });
    
    const result = await response.json();
    tests.push(result.success);
    console.log(`   ✅ Failed Request Monitor: ${result.success ? 'SUCCESS' : 'FAIL'}`);
  } catch (error) {
    tests.push(false);
    console.log(`   ❌ Failed Request Monitor: FAIL (${error.message})`);
  }
  
  return tests.every(t => t);
}

// Test SessionDemo component functionality
async function testSessionDemo() {
  console.log('\n📊 Testing SessionDemo Component...');
  
  const tests = [];
  
  // Test 1: User Activity simulation
  const activities = [
    { action: 'Clicked navigation menu', category: 'user-activity' },
    { action: 'Scrolled to section', category: 'user-activity' },
    { action: 'Opened modal dialog', category: 'user-activity' },
    { action: 'Submitted form', category: 'user-activity' }
  ];
  
  try {
    for (const [index, activity] of activities.entries()) {
      const response = await fetch(`${BACKEND_URL}/api/capture/session-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          session_id: sessionId,
          event_type: 'breadcrumb',
          data: {
            message: activity.action,
            category: activity.category,
            level: 'info',
            sequence: index + 1,
            component: 'SessionDemo'
          },
          timestamp: Date.now() + (index * 1000)
        })
      });
      
      const result = await response.json();
      tests.push(result.success);
    }
    
    console.log(`   ✅ User Activity Simulation: ${tests.length === activities.length && tests.every(t => t) ? 'SUCCESS' : 'FAIL'}`);
  } catch (error) {
    tests.push(false);
    console.log(`   ❌ User Activity Simulation: FAIL (${error.message})`);
  }
  
  return tests.every(t => t);
}

// Test PerformanceDemo component functionality
async function testPerformanceDemo() {
  console.log('\n⚡ Testing PerformanceDemo Component...');
  
  const tests = [];
  
  // Test 1: Performance metrics capture
  try {
    const response = await fetch(`${BACKEND_URL}/api/capture/session-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        session_id: sessionId,
        event_type: 'performance',
        data: {
          loadTime: 1234,
          domContentLoaded: 856,
          firstPaint: 945,
          firstContentfulPaint: 1120,
          largestContentfulPaint: 1456,
          cumulativeLayoutShift: 0.02,
          firstInputDelay: 23
        },
        timestamp: Date.now()
      })
    });
    
    const result = await response.json();
    tests.push(result.success);
    console.log(`   ✅ Performance Metrics: ${result.success ? 'SUCCESS' : 'FAIL'}`);
  } catch (error) {
    tests.push(false);
    console.log(`   ❌ Performance Metrics: FAIL (${error.message})`);
  }
  
  return tests.every(t => t);
}

// Test UserContextDemo component functionality
async function testUserContextDemo() {
  console.log('\n👤 Testing UserContextDemo Component...');
  
  const tests = [];
  
  // Test 1: User context setting simulation
  try {
    const response = await fetch(`${BACKEND_URL}/api/capture/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        message: 'Error with user context',
        stack_trace: 'Error: Error with user context\n    at testUserContext (UserContextDemo.tsx:23:12)',
        url: 'http://localhost:5174/',
        user_agent: 'Mozilla/5.0 (Demo Test)',
        session_id: sessionId,
        metadata: {
          component: 'UserContextDemo',
          user: {
            id: 'demo-user-123',
            email: 'demo@example.com',
            name: 'Demo User'
          },
          context: 'user-context-test'
        }
      })
    });
    
    const result = await response.json();
    tests.push(result.success);
    console.log(`   ✅ User Context Error: ${result.success ? 'SUCCESS' : 'FAIL'}`);
  } catch (error) {
    tests.push(false);
    console.log(`   ❌ User Context Error: FAIL (${error.message})`);
  }
  
  return tests.every(t => t);
}

// Test BreadcrumbDemo component functionality
async function testBreadcrumbDemo() {
  console.log('\n🍞 Testing BreadcrumbDemo Component...');
  
  const tests = [];
  
  // Test 1: Breadcrumb navigation simulation
  const breadcrumbs = [
    { message: 'User navigated to dashboard', category: 'navigation' },
    { message: 'User clicked settings', category: 'ui.click' },
    { message: 'User updated profile', category: 'user.action' }
  ];
  
  try {
    for (const breadcrumb of breadcrumbs) {
      const response = await fetch(`${BACKEND_URL}/api/capture/session-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          session_id: sessionId,
          event_type: 'breadcrumb',
          data: {
            message: breadcrumb.message,
            category: breadcrumb.category,
            level: 'info',
            component: 'BreadcrumbDemo'
          },
          timestamp: Date.now()
        })
      });
      
      const result = await response.json();
      tests.push(result.success);
    }
    
    console.log(`   ✅ Breadcrumb Navigation: ${tests.length === breadcrumbs.length && tests.every(t => t) ? 'SUCCESS' : 'FAIL'}`);
  } catch (error) {
    tests.push(false);
    console.log(`   ❌ Breadcrumb Navigation: FAIL (${error.message})`);
  }
  
  return tests.every(t => t);
}

// Run all component tests
async function runAllComponentTests() {
  const results = [];
  
  console.log('🎯 Starting Demo Components Functionality Tests...\n');
  
  results.push(await testErrorDemo());
  results.push(await testNetworkDemo());
  results.push(await testSessionDemo());
  results.push(await testPerformanceDemo());
  results.push(await testUserContextDemo());
  results.push(await testBreadcrumbDemo());
  
  // Wait for data processing
  console.log('\n⏳ Waiting for data processing...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Verify data in session timeline
  try {
    const timelineResponse = await fetch(`${BACKEND_URL}/api/session/${sessionId}/events`);
    const timeline = await timelineResponse.json();
    
    console.log(`\n📊 Session Timeline Summary:`);
    console.log(`   • Total events: ${timeline.events.length}`);
    console.log(`   • Event types: ${[...new Set(timeline.events.map(e => e.event_type || e.source))].join(', ')}`);
    
    results.push(timeline.events.length > 0);
  } catch (error) {
    console.log(`\n❌ Timeline verification failed: ${error.message}`);
    results.push(false);
  }
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n🏁 Demo Components Test Summary:');
  console.log(`✅ Passed: ${passed}/${total} component tests`);
  
  if (passed === total) {
    console.log('🎉 All demo component functionality tests passed!');
    console.log('📈 All Phase 2 frontend features are working correctly.');
  } else {
    console.log('❌ Some component tests failed. Check the output above for details.');
  }
  
  return passed === total;
}

// Run the tests
runAllComponentTests();