// Test script to simulate SDK integration with backend
const session_id = 'e2e_test_session_' + Date.now();
const api_key = 'revi_demo_api_key_for_testing_12345678901234567890';
const base_url = 'http://localhost:4000';

console.log('🧪 Starting End-to-End SDK Integration Test');
console.log('Session ID:', session_id);

// Test 1: Capture a session event (user click)
async function testSessionEventCapture() {
  console.log('\n📝 Test 1: Capturing session event (click)...');
  
  const response = await fetch(`${base_url}/api/capture/session-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': api_key
    },
    body: JSON.stringify({
      session_id: session_id,
      event_type: 'click',
      data: {
        target: {
          tagName: 'BUTTON',
          id: 'demo-error-btn',
          className: 'bg-red-500 text-white px-4 py-2',
          textContent: 'Trigger Error'
        },
        coordinates: { x: 234, y: 156 },
        timestamp: Date.now()
      },
      timestamp: Date.now()
    })
  });
  
  const result = await response.json();
  console.log('✅ Session event captured:', result);
  return result.success;
}

// Test 2: Capture a network event (API call)
async function testNetworkEventCapture() {
  console.log('\n🌐 Test 2: Capturing network event (API call)...');
  
  const response = await fetch(`${base_url}/api/capture/network-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': api_key
    },
    body: JSON.stringify({
      session_id: session_id,
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      status_code: 200,
      response_time: 156,
      timestamp: Date.now(),
      request_data: {
        headers: { 'Accept': 'application/json' },
        body: null
      },
      response_data: {
        headers: { 'Content-Type': 'application/json' },
        body: { id: 1, title: 'sunt aut facere', body: 'quia et suscipit...' }
      }
    })
  });
  
  const result = await response.json();
  console.log('✅ Network event captured:', result);
  return result.success;
}

// Test 3: Capture an error event
async function testErrorCapture() {
  console.log('\n🚨 Test 3: Capturing error event...');
  
  const response = await fetch(`${base_url}/api/capture/error`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': api_key
    },
    body: JSON.stringify({
      message: 'TypeError: Cannot read property "length" of undefined',
      stack_trace: `TypeError: Cannot read property 'length' of undefined
    at processData (/demo-app/utils.js:15:23)
    at handleClick (/demo-app/components/Demo.tsx:42:11)
    at HTMLButtonElement.<anonymous> (/demo-app/components/Demo.tsx:38:9)`,
      url: 'http://localhost:5173/demo',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      session_id: session_id,
      metadata: {
        component: 'Demo',
        action: 'handleClick',
        browser: 'Chrome',
        version: '120.0.0.0',
        timestamp: Date.now(),
        userAgent: 'Chrome/120.0.0.0 on macOS 10.15.7'
      }
    })
  });
  
  const result = await response.json();
  console.log('✅ Error captured:', result);
  return result.success;
}

// Test 4: Retrieve session timeline
async function testSessionRetrieval() {
  console.log('\n📊 Test 4: Retrieving session timeline...');
  
  const response = await fetch(`${base_url}/api/session/${session_id}/events`);
  const result = await response.json();
  
  console.log('✅ Session timeline retrieved:');
  console.log(`   - Total events: ${result.events.length}`);
  console.log('   - Event types:', result.events.map(e => e.event_type || e.source));
  
  result.events.forEach((event, index) => {
    console.log(`   ${index + 1}. ${event.event_type || event.source} at ${event.timestamp}`);
  });
  
  return result.events.length > 0;
}

// Test 5: Retrieve project errors
async function testErrorListing() {
  console.log('\n📋 Test 5: Retrieving project errors...');
  
  const response = await fetch(`${base_url}/api/errors/1?limit=5`);
  const result = await response.json();
  
  console.log('✅ Project errors retrieved:');
  console.log(`   - Total errors: ${result.errors.length}`);
  
  result.errors.forEach((error, index) => {
    console.log(`   ${index + 1}. ${error.message} (Session: ${error.session_id})`);
  });
  
  return result.errors.length > 0;
}

// Run all tests
async function runAllTests() {
  try {
    const results = [];
    
    results.push(await testSessionEventCapture());
    results.push(await testNetworkEventCapture());
    results.push(await testErrorCapture());
    
    // Wait a moment for data to be processed
    console.log('\n⏳ Waiting for data processing...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    results.push(await testSessionRetrieval());
    results.push(await testErrorListing());
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log('\n🏁 Test Summary:');
    console.log(`✅ Passed: ${passed}/${total} tests`);
    
    if (passed === total) {
      console.log('🎉 All end-to-end tests passed! SDK integration is working correctly.');
    } else {
      console.log('❌ Some tests failed. Check the output above for details.');
    }
    
    return passed === total;
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    return false;
  }
}

// Only run if called directly (not imported)
if (typeof window === 'undefined') {
  runAllTests();
}