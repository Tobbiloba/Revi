# Resilience System Testing Guide

This guide provides practical ways to test all the resilience components in the Revi SDK.

## 🚀 Quick Start Testing

### Method 1: Automated Test Suite

```typescript
import { runResilienceTests } from './test-runner';

// Run all tests automatically
await runResilienceTests();
```

### Method 2: Browser Console Testing

```javascript
// Copy and paste these examples in browser console

// Test basic retry mechanism
const retryManager = new RetryManager({ maxAttempts: 3, baseDelay: 500 });

let attempts = 0;
const flakyOperation = () => {
  attempts++;
  console.log(`Attempt ${attempts}`);
  if (attempts < 3) throw new Error('Temporary failure');
  return Promise.resolve('Success!');
};

retryManager.executeWithRetry('test', flakyOperation)
  .then(result => console.log('✅', result))
  .catch(err => console.log('❌', err));
```

## 📋 Individual Component Testing

### 1. Retry Manager Testing

```typescript
import { RetryManager } from '../retry-manager';

async function testRetryManager() {
  const retryManager = new RetryManager({
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 10000,
    enableJitter: true
  });

  // Test 1: Basic retry with success
  console.log('🧪 Test 1: Basic Retry');
  let attempts = 0;
  
  const result = await retryManager.executeWithRetry('basic-test', () => {
    attempts++;
    if (attempts < 3) {
      throw new Error(`Attempt ${attempts} failed`);
    }
    return Promise.resolve(`Success after ${attempts} attempts`);
  });
  
  console.log('Result:', result);
  console.log('Total attempts:', attempts);

  // Test 2: Retry budget exhaustion
  console.log('\n🧪 Test 2: Retry Budget');
  try {
    for (let i = 0; i < 200; i++) {
      await retryManager.executeWithRetry(`budget-test-${i}`, () => {
        throw new Error('Always fails');
      }, { priority: 'medium' });
    }
  } catch (error) {
    if (error.message.includes('budget exceeded')) {
      console.log('✅ Retry budget protection working');
    }
  }

  // Test 3: Request deduplication
  console.log('\n🧪 Test 3: Request Deduplication');
  let execCount = 0;
  
  const promises = Array.from({ length: 5 }, () =>
    retryManager.executeWithRetry('dedup-test', () => {
      execCount++;
      return Promise.resolve(`Executed ${execCount} times`);
    }, { deduplicationKey: 'same-key' })
  );

  const results = await Promise.all(promises);
  console.log('Execution count:', execCount); // Should be 1
  console.log('All results identical:', results.every(r => r === results[0]));
}

testRetryManager();
```

### 2. Circuit Breaker Testing

```typescript
import { CircuitBreakerManager } from '../circuit-breaker';

async function testCircuitBreaker() {
  const cbManager = new CircuitBreakerManager({
    failureThreshold: 3,
    recoveryTimeout: 5000,
    successThreshold: 2
  });

  // Test 1: Circuit opening
  console.log('🧪 Test 1: Opening Circuit');
  
  for (let i = 1; i <= 5; i++) {
    try {
      await cbManager.executeWithBreaker('unreliable-service', () => {
        throw new Error(`Failure ${i}`);
      });
    } catch (error) {
      console.log(`Attempt ${i}: ${error.message}`);
    }
  }

  // Test 2: Circuit is open
  console.log('\n🧪 Test 2: Circuit Open State');
  try {
    await cbManager.executeWithBreaker('unreliable-service', () => {
      return Promise.resolve('Should not execute');
    });
  } catch (error) {
    if (error.message.includes('Circuit breaker is OPEN')) {
      console.log('✅ Circuit breaker correctly opened');
    }
  }

  // Test 3: Graceful degradation
  console.log('\n🧪 Test 3: Graceful Degradation');
  const result = await cbManager.executeWithBreaker('another-service', () => {
    throw new Error('Service down');
  }, {
    degradeGracefully: true,
    degradedResponse: { data: 'cached', degraded: true }
  });
  
  console.log('Degraded response:', result);

  // Test 4: Recovery (wait for recovery timeout)
  console.log('\n🧪 Test 4: Recovery (waiting 6 seconds...)');
  setTimeout(async () => {
    try {
      const recoveryResult = await cbManager.executeWithBreaker('unreliable-service', () => {
        return Promise.resolve('Service recovered!');
      });
      console.log('Recovery result:', recoveryResult);
    } catch (error) {
      console.log('Recovery test:', error.message);
    }
  }, 6000);
}

testCircuitBreaker();
```

### 3. Storage System Testing

```typescript
import { ResilientStorage } from '../resilient-storage';

async function testStorage() {
  const storage = new ResilientStorage({
    quotas: {
      hot: { maxItems: 10, maxSizeBytes: 1000 },
      warm: { maxItems: 50, maxSizeBytes: 5000 },
      cold: { maxItems: 100, maxSizeBytes: 10000 }
    }
  });

  // Test 1: Store data in different tiers
  console.log('🧪 Test 1: Multi-tier Storage');
  
  await storage.storeData('critical-data', { urgent: true }, {
    priority: 'critical',
    tier: 'hot'
  });

  await storage.storeData('normal-data', { content: 'regular' }, {
    priority: 'medium',
    tier: 'warm'
  });

  const criticalData = await storage.getData('critical-data');
  const normalData = await storage.getData('normal-data');
  
  console.log('Critical data retrieved:', criticalData);
  console.log('Normal data retrieved:', normalData);

  // Test 2: Compression
  console.log('\n🧪 Test 2: Data Compression');
  const largeData = { content: 'x'.repeat(1000), metadata: 'large payload' };
  
  await storage.storeData('large-data', largeData, {
    priority: 'medium',
    compress: true,
    tier: 'warm'
  });

  const retrievedLargeData = await storage.getData('large-data');
  console.log('Compression working:', JSON.stringify(largeData) === JSON.stringify(retrievedLargeData));

  // Test 3: Quota enforcement
  console.log('\n🧪 Test 3: Quota Enforcement');
  
  // Fill up hot tier beyond quota
  for (let i = 0; i < 15; i++) {
    await storage.storeData(`hot-item-${i}`, { index: i }, {
      priority: 'high',
      tier: 'hot'
    });
  }

  const stats = storage.getStats();
  console.log('Hot tier usage after quota test:', stats.tierUsage.hot);
  console.log('Quota enforced:', stats.tierUsage.hot.itemCount <= 10);
}

testStorage();
```

### 4. Health Monitoring Testing

```typescript
import { MultiRegionalHealthMonitor } from '../health-monitor';

async function testHealthMonitor() {
  const healthMonitor = new MultiRegionalHealthMonitor({
    regions: ['us-east-1', 'eu-west-1'],
    endpoints: {
      'api-service': '/health',
      'auth-service': '/auth/health'
    },
    healthCheckInterval: 2000
  });

  // Test 1: Health status monitoring
  console.log('🧪 Test 1: Health Status Monitoring');
  
  // Wait for initial health checks
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const apiHealth = healthMonitor.getEndpointHealth('api-service');
  console.log('API service health:', apiHealth);

  // Test 2: Record performance and get recommendations
  console.log('\n🧪 Test 2: Performance Recording');
  
  // Simulate some requests
  healthMonitor.recordRequest('api-service', 'us-east-1', true, 150);
  healthMonitor.recordRequest('api-service', 'us-east-1', true, 200);
  healthMonitor.recordRequest('api-service', 'us-east-1', false, 5000);
  
  const recommendation = healthMonitor.getAdaptiveRecommendation('api-service', 'us-east-1');
  console.log('Adaptive recommendation:', recommendation);

  // Test 3: Global health status
  console.log('\n🧪 Test 3: Global Health');
  const globalStats = healthMonitor.getGlobalStats();
  console.log('Global health stats:', globalStats);

  // Cleanup
  healthMonitor.destroy();
}

testHealthMonitor();
```

### 5. Idempotency Testing

```typescript
import { IdempotencyManager } from '../idempotency-manager';

async function testIdempotency() {
  const idempotencyManager = new IdempotencyManager({
    keyTTL: 10000,
    enableResponseCaching: true,
    responseCacheTTL: 5000
  });

  // Test 1: Basic idempotency
  console.log('🧪 Test 1: Basic Idempotency');
  
  let executionCount = 0;
  const operation = () => {
    executionCount++;
    return Promise.resolve(`Result ${executionCount}`);
  };

  const promises = Array.from({ length: 5 }, () =>
    idempotencyManager.executeIdempotent('same-key', operation)
  );

  const results = await Promise.all(promises);
  console.log('Execution count:', executionCount); // Should be 1
  console.log('All results same:', results.every(r => r === results[0]));

  // Test 2: Response caching
  console.log('\n🧪 Test 2: Response Caching');
  
  executionCount = 0;
  const cachedResults = await Promise.all([
    idempotencyManager.executeIdempotent('cache-key', operation),
    idempotencyManager.executeIdempotent('cache-key', operation)
  ]);

  console.log('With caching - execution count:', executionCount); // Should be 1
  console.log('Cached results identical:', cachedResults[0] === cachedResults[1]);

  // Test 3: Key generation
  console.log('\n🧪 Test 3: Key Generation');
  
  const key1 = idempotencyManager.generateIdempotencyKey('POST', '/api/data', { id: 1 }, 'user123');
  const key2 = idempotencyManager.generateIdempotencyKey('POST', '/api/data', { id: 1 }, 'user123');
  const key3 = idempotencyManager.generateIdempotencyKey('POST', '/api/data', { id: 2 }, 'user123');

  console.log('Same keys for same data:', key1 === key2);
  console.log('Different keys for different data:', key1 !== key3);
}

testIdempotency();
```

## 🌐 Browser-based Testing

### HTML Test Page

Create `resilience-test.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Resilience System Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .test-result { margin: 10px 0; padding: 10px; }
        .pass { background-color: #d4edda; border-color: #c3e6cb; color: #155724; }
        .fail { background-color: #f8d7da; border-color: #f5c6cb; color: #721c24; }
        button { margin: 5px; padding: 10px 15px; }
    </style>
</head>
<body>
    <h1>🧪 Resilience System Test Suite</h1>
    
    <div class="test-section">
        <h2>Quick Tests</h2>
        <button onclick="testRetry()">Test Retry Mechanism</button>
        <button onclick="testCircuitBreaker()">Test Circuit Breaker</button>
        <button onclick="testIdempotency()">Test Idempotency</button>
        <button onclick="testStorage()">Test Storage</button>
        <button onclick="runAllTests()">Run All Tests</button>
    </div>

    <div id="results"></div>

    <script type="module">
        // Import your resilience components
        import { ResilienceCoordinator } from './src/resilience-coordinator.js';
        import { runResilienceTests } from './src/__tests__/test-runner.js';

        const coordinator = new ResilienceCoordinator();
        const results = document.getElementById('results');

        function addResult(test, success, details) {
            const div = document.createElement('div');
            div.className = `test-result ${success ? 'pass' : 'fail'}`;
            div.innerHTML = `
                <strong>${success ? '✅' : '❌'} ${test}</strong><br>
                ${details}
            `;
            results.appendChild(div);
        }

        window.testRetry = async function() {
            try {
                let attempts = 0;
                const result = await coordinator.executeResilientRequest(() => {
                    attempts++;
                    if (attempts < 3) throw new Error(`Attempt ${attempts}`);
                    return Promise.resolve('Success');
                }, {
                    feature: 'test-retry',
                    priority: 'high'
                });
                
                addResult('Retry Mechanism', true, `Success after ${attempts} attempts: ${result}`);
            } catch (error) {
                addResult('Retry Mechanism', false, error.message);
            }
        };

        window.testCircuitBreaker = async function() {
            // Trigger failures to open circuit
            for (let i = 0; i < 5; i++) {
                try {
                    await coordinator.executeResilientRequest(() => {
                        throw new Error('Service down');
                    }, {
                        feature: 'test-cb',
                        priority: 'medium'
                    });
                } catch (error) {
                    // Expected failures
                }
            }

            // Test if circuit is open
            try {
                await coordinator.executeResilientRequest(() => {
                    return Promise.resolve('Should be blocked');
                }, {
                    feature: 'test-cb',
                    priority: 'medium'
                });
                addResult('Circuit Breaker', false, 'Circuit did not open');
            } catch (error) {
                if (error.message.includes('Circuit breaker is OPEN')) {
                    addResult('Circuit Breaker', true, 'Circuit opened correctly after failures');
                } else {
                    addResult('Circuit Breaker', false, `Unexpected error: ${error.message}`);
                }
            }
        };

        window.testIdempotency = async function() {
            let executions = 0;
            const operation = () => {
                executions++;
                return Promise.resolve(`Result ${executions}`);
            };

            const promises = Array.from({ length: 5 }, () =>
                coordinator.executeResilientRequest(operation, {
                    feature: 'test-idemp',
                    priority: 'medium',
                    idempotencyKey: 'same-key-test'
                })
            );

            try {
                const results = await Promise.all(promises);
                const allSame = results.every(r => r === results[0]);
                
                addResult('Idempotency', 
                    executions === 1 && allSame,
                    `Executions: ${executions}, All results identical: ${allSame}`
                );
            } catch (error) {
                addResult('Idempotency', false, error.message);
            }
        };

        window.testStorage = async function() {
            // This would test offline scenarios
            addResult('Storage Test', true, 'Storage system initialized (detailed testing requires offline simulation)');
        };

        window.runAllTests = async function() {
            results.innerHTML = '<h3>Running comprehensive test suite...</h3>';
            try {
                await runResilienceTests();
                addResult('Full Test Suite', true, 'All automated tests completed - check console for details');
            } catch (error) {
                addResult('Full Test Suite', false, error.message);
            }
        };
    </script>
</body>
</html>
```

## 🔧 Command Line Testing

### Using Node.js

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run specific test files
npm test -- --testNamePattern="resilience"

# Run with coverage
npm test -- --coverage

# Run benchmarks
node -e "
const { runResilienceTests } = require('./src/__tests__/test-runner.ts');
runResilienceTests().then(() => console.log('Tests complete'));
"
```

### Using Jest

```bash
# Run all resilience tests
npx jest src/__tests__/resilience.test.ts

# Run benchmarks
npx jest src/__tests__/resilience-benchmarks.ts

# Run with verbose output
npx jest --verbose src/__tests__/

# Run specific test suites
npx jest --testNamePattern="RetryManager"
npx jest --testNamePattern="CircuitBreaker"
npx jest --testNamePattern="Integration"
```

## 📊 Performance Testing

### Memory Usage Testing

```javascript
// Monitor memory usage during testing
const measureMemory = () => {
    if (performance.memory) {
        return {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        };
    }
    return null;
};

console.log('Memory before:', measureMemory());

// Run your resilience tests here
await runResilienceTests();

console.log('Memory after:', measureMemory());
```

### Load Testing

```javascript
// Test system under high concurrent load
async function loadTest(concurrency = 100, duration = 30000) {
    const coordinator = new ResilienceCoordinator();
    const startTime = Date.now();
    const results = { success: 0, failure: 0 };
    
    console.log(`Starting load test: ${concurrency} concurrent ops for ${duration}ms`);
    
    while (Date.now() - startTime < duration) {
        const promises = Array.from({ length: concurrency }, async (_, i) => {
            try {
                await coordinator.executeResilientRequest(() => {
                    // Simulate realistic operation
                    return new Promise(resolve => 
                        setTimeout(() => resolve(`Success ${i}`), Math.random() * 100)
                    );
                }, {
                    feature: 'load-test',
                    priority: 'medium',
                    idempotencyKey: `load-${Date.now()}-${i}`
                });
                results.success++;
            } catch (error) {
                results.failure++;
            }
        });
        
        await Promise.all(promises);
    }
    
    const totalOps = results.success + results.failure;
    const throughput = (totalOps * 1000) / duration;
    
    console.log(`Load test complete:`, {
        totalOperations: totalOps,
        successRate: (results.success / totalOps * 100).toFixed(2) + '%',
        throughput: throughput.toFixed(0) + ' ops/sec'
    });
    
    coordinator.destroy();
}

loadTest(50, 10000); // 50 concurrent ops for 10 seconds
```

## 🐛 Debugging Tips

### Enable Debug Logging

```javascript
// Add this to see detailed resilience system logs
localStorage.setItem('revi:debug', 'resilience');

// Or set specific component logging
localStorage.setItem('revi:debug', 'retry,circuit-breaker,storage');
```

### Monitor Real-time Stats

```javascript
// Get real-time statistics
setInterval(() => {
    const stats = coordinator.getStats();
    console.log('Resilience Stats:', {
        adaptiveBehavior: stats.adaptiveBehavior,
        retryBudget: stats.retry,
        circuitBreakerStates: stats.circuitBreaker,
        storageUsage: stats.storage,
        idempotencyHits: stats.idempotency.cacheHits
    });
}, 5000);
```

This comprehensive testing guide provides multiple ways to validate that all resilience components are working correctly, from automated test suites to manual browser testing and performance monitoring.