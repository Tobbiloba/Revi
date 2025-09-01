// Test script to verify frontend SDK initialization and API connectivity
const API_KEY = 'revi_demo_api_key_for_testing_12345678901234567890';
const BACKEND_URL = 'http://localhost:4000';
const FRONTEND_URL = 'http://localhost:5174';

console.log('🧪 Testing Frontend SDK Integration');

// Test 1: Check if frontend loads without errors
async function testFrontendLoading() {
  console.log('\n📋 Test 1: Frontend Loading...');
  
  try {
    const response = await fetch(FRONTEND_URL);
    const html = await response.text();
    
    // Check if React app structure exists
    const hasRootDiv = html.includes('id="root"');
    const hasReactScript = html.includes('main.tsx');
    const hasSDKImport = html.includes('revi-monitor') || html.includes('App.tsx');
    
    console.log(`   ✅ Frontend responds: ${response.status === 200 ? 'OK' : 'FAIL'}`);
    console.log(`   ✅ Has root div: ${hasRootDiv ? 'YES' : 'NO'}`);
    console.log(`   ✅ Has React scripts: ${hasReactScript ? 'YES' : 'NO'}`);
    
    return response.status === 200 && hasRootDiv;
  } catch (error) {
    console.log(`   ❌ Frontend loading failed: ${error.message}`);
    return false;
  }
}

// Test 2: Test manual SDK API calls to verify backend connectivity
async function testSDKAPIConnectivity() {
  console.log('\n🔌 Test 2: SDK API Connectivity...');
  
  const sessionId = 'frontend_test_' + Date.now();
  
  // Test error capture endpoint
  try {
    const errorResponse = await fetch(`${BACKEND_URL}/api/capture/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        message: 'Frontend SDK test error',
        stack_trace: 'Error\n    at testSDKAPIConnectivity (frontend-sdk-test.js:35:12)',
        url: FRONTEND_URL,
        user_agent: 'Node.js Test Agent',
        session_id: sessionId,
        metadata: {
          source: 'frontend-test',
          test: true
        }
      })
    });
    
    const errorResult = await errorResponse.json();
    console.log(`   ✅ Error capture: ${errorResult.success ? 'SUCCESS' : 'FAIL'}`);
    
    // Test session event endpoint
    const sessionResponse = await fetch(`${BACKEND_URL}/api/capture/session-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        session_id: sessionId,
        event_type: 'frontend_init',
        data: {
          url: FRONTEND_URL,
          component: 'App',
          action: 'initialization'
        },
        timestamp: Date.now()
      })
    });
    
    const sessionResult = await sessionResponse.json();
    console.log(`   ✅ Session event: ${sessionResult.success ? 'SUCCESS' : 'FAIL'}`);
    
    // Test network event endpoint
    const networkResponse = await fetch(`${BACKEND_URL}/api/capture/network-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        session_id: sessionId,
        method: 'GET',
        url: `${FRONTEND_URL}/test-api-call`,
        status_code: 200,
        response_time: 125,
        timestamp: Date.now(),
        request_data: {
          headers: { 'Accept': 'application/json' }
        },
        response_data: {
          headers: { 'Content-Type': 'application/json' },
          body: { message: 'test' }
        }
      })
    });
    
    const networkResult = await networkResponse.json();
    console.log(`   ✅ Network event: ${networkResult.success ? 'SUCCESS' : 'FAIL'}`);
    
    return errorResult.success && sessionResult.success && networkResult.success;
  } catch (error) {
    console.log(`   ❌ API connectivity failed: ${error.message}`);
    return false;
  }
}

// Test 3: Simulate browser-based SDK functionality
async function testBrowserSDKSimulation() {
  console.log('\n🌐 Test 3: Browser SDK Simulation...');
  
  // Test if we can import and use the SDK module structure
  try {
    // Read the built SDK file to verify it has expected exports
    const fs = require('fs');
    const path = require('path');
    
    const sdkPath = path.join(__dirname, 'frontend/revi-monitor/dist/index.esm.js');
    const sdkContent = fs.readFileSync(sdkPath, 'utf8');
    
    const hasMonitorClass = sdkContent.includes('Monitor');
    const hasErrorHandler = sdkContent.includes('ErrorHandler') || sdkContent.includes('captureException');
    const hasSessionManager = sdkContent.includes('SessionManager') || sdkContent.includes('getSessionId');
    const hasNetworkMonitor = sdkContent.includes('NetworkMonitor') || sdkContent.includes('fetch');
    const hasDataManager = sdkContent.includes('DataManager') || sdkContent.includes('queue');
    
    console.log(`   ✅ Monitor class: ${hasMonitorClass ? 'FOUND' : 'MISSING'}`);
    console.log(`   ✅ Error handling: ${hasErrorHandler ? 'FOUND' : 'MISSING'}`);
    console.log(`   ✅ Session management: ${hasSessionManager ? 'FOUND' : 'MISSING'}`);
    console.log(`   ✅ Network monitoring: ${hasNetworkMonitor ? 'FOUND' : 'MISSING'}`);
    console.log(`   ✅ Data management: ${hasDataManager ? 'FOUND' : 'MISSING'}`);
    
    const allComponentsPresent = hasMonitorClass && hasErrorHandler && hasSessionManager && hasNetworkMonitor && hasDataManager;
    
    if (allComponentsPresent) {
      console.log('   🎉 All SDK components are present in built bundle');
    }
    
    return allComponentsPresent;
  } catch (error) {
    console.log(`   ❌ SDK simulation failed: ${error.message}`);
    return false;
  }
}

// Test 4: Verify data reaches database
async function testDatabaseIntegration() {
  console.log('\n🗄️  Test 4: Database Integration...');
  
  try {
    // Create test data
    const sessionId = 'frontend_db_test_' + Date.now();
    
    // Send test error
    await fetch(`${BACKEND_URL}/api/capture/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        message: 'Frontend database integration test',
        stack_trace: 'Test stack trace',
        url: FRONTEND_URL,
        user_agent: 'Frontend Test',
        session_id: sessionId
      })
    });
    
    // Wait for data processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if data appears in database via API
    const response = await fetch(`${BACKEND_URL}/api/errors/1?limit=5`);
    const result = await response.json();
    
    const hasTestError = result.errors.some(error => 
      error.message === 'Frontend database integration test'
    );
    
    console.log(`   ✅ Test error in database: ${hasTestError ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`   ✅ Total errors in DB: ${result.errors.length}`);
    
    return hasTestError;
  } catch (error) {
    console.log(`   ❌ Database integration test failed: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const results = [];
  
  console.log('🚀 Starting Frontend SDK Integration Tests...\n');
  
  results.push(await testFrontendLoading());
  results.push(await testSDKAPIConnectivity());
  results.push(await testBrowserSDKSimulation());
  results.push(await testDatabaseIntegration());
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n🏁 Frontend SDK Test Summary:');
  console.log(`✅ Passed: ${passed}/${total} tests`);
  
  if (passed === total) {
    console.log('🎉 All frontend SDK tests passed! Phase 2 frontend functionality is working correctly.');
  } else {
    console.log('❌ Some tests failed. Frontend SDK may have issues.');
  }
  
  return passed === total;
}

// Run the tests
runAllTests();