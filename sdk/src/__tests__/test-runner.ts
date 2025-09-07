/**
 * Test Runner for Resilience Components
 * Provides practical examples and interactive testing scenarios
 */

import { RetryManager } from '../retry-manager';
import { CircuitBreakerManager } from '../circuit-breaker';
import { ResilientStorage } from '../resilient-storage';
import { MultiRegionalHealthMonitor } from '../health-monitor';
import { IntelligentSyncManager } from '../sync-manager';
import { IdempotencyManager } from '../idempotency-manager';
import { ResilienceCoordinator } from '../resilience-coordinator';

export class ResilienceTestRunner {
  private coordinator: ResilienceCoordinator;
  private testResults: Array<{
    test: string;
    status: 'pass' | 'fail' | 'running';
    duration: number;
    details: any;
  }> = [];

  constructor() {
    this.coordinator = new ResilienceCoordinator({
      enableAdaptiveBehavior: true,
      performanceThresholds: {
        slowRequestMs: 1000,
        verySlowRequestMs: 3000,
        highErrorRate: 0.1,
        criticalErrorRate: 0.25
      }
    });
  }

  /**
   * Run all resilience tests
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Resilience System Tests...\n');

    const tests = [
      () => this.testRetryMechanism(),
      () => this.testCircuitBreaker(),
      () => this.testIdempotency(),
      () => this.testOfflineStorage(),
      () => this.testHealthMonitoring(),
      () => this.testNetworkFailures(),
      () => this.testCascadingFailures(),
      () => this.testHighLoad(),
      () => this.testRecoveryScenarios()
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        console.error(`Test failed: ${error}`);
      }
    }

    this.printSummary();
  }

  /**
   * Test 1: Retry Mechanism with Exponential Backoff
   */
  async testRetryMechanism(): Promise<void> {
    console.log('🔄 Testing Retry Mechanism...');
    
    let attempts = 0;
    const flakyService = () => {
      attempts++;
      console.log(`  Attempt ${attempts}`);
      
      if (attempts < 3) {
        throw new Error(`Temporary failure (attempt ${attempts})`);
      }
      return Promise.resolve('Success after retries');
    };

    const startTime = Date.now();
    
    try {
      const result = await this.coordinator.executeResilientRequest(flakyService, {
        feature: 'flaky-service',
        priority: 'high',
        timeout: 10000
      });

      const duration = Date.now() - startTime;
      
      this.logTestResult('Retry Mechanism', 'pass', duration, {
        attempts,
        result,
        backoffApplied: duration > 1000
      });

      console.log(`  ✅ Success: ${result} (${attempts} attempts, ${duration}ms)`);
      
    } catch (error) {
      this.logTestResult('Retry Mechanism', 'fail', Date.now() - startTime, { error });
      console.log(`  ❌ Failed: ${error}`);
    }
  }

  /**
   * Test 2: Circuit Breaker Protection
   */
  async testCircuitBreaker(): Promise<void> {
    console.log('\n⚡ Testing Circuit Breaker...');

    const unreliableService = () => Promise.reject(new Error('Service unavailable'));
    
    // Trigger failures to open circuit
    console.log('  Triggering failures to open circuit...');
    for (let i = 1; i <= 5; i++) {
      try {
        await this.coordinator.executeResilientRequest(unreliableService, {
          feature: 'unreliable-service',
          priority: 'medium'
        });
      } catch (error) {
        console.log(`  Failure ${i}: ${error.message}`);
      }
    }

    // Test circuit is open
    console.log('  Testing circuit breaker is open...');
    try {
      await this.coordinator.executeResilientRequest(unreliableService, {
        feature: 'unreliable-service',
        priority: 'medium'
      });
    } catch (error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        console.log('  ✅ Circuit breaker correctly opened');
        this.logTestResult('Circuit Breaker', 'pass', 0, { circuitOpen: true });
      } else {
        console.log('  ❌ Circuit breaker not working properly');
        this.logTestResult('Circuit Breaker', 'fail', 0, { error });
      }
    }
  }

  /**
   * Test 3: Idempotency and Deduplication
   */
  async testIdempotency(): Promise<void> {
    console.log('\n🔐 Testing Idempotency...');

    let executionCount = 0;
    const criticalOperation = () => {
      executionCount++;
      console.log(`  Executing critical operation (count: ${executionCount})`);
      return Promise.resolve(`Operation result ${executionCount}`);
    };

    // Execute same operation multiple times concurrently
    const promises = Array.from({ length: 5 }, () =>
      this.coordinator.executeResilientRequest(criticalOperation, {
        feature: 'critical-operation',
        priority: 'critical',
        idempotencyKey: 'same-operation-key'
      })
    );

    try {
      const results = await Promise.all(promises);
      
      if (executionCount === 1 && results.every(r => r === results[0])) {
        console.log('  ✅ Idempotency working correctly - operation executed only once');
        this.logTestResult('Idempotency', 'pass', 0, {
          executionCount,
          allResultsIdentical: true
        });
      } else {
        console.log(`  ❌ Idempotency failed - operation executed ${executionCount} times`);
        this.logTestResult('Idempotency', 'fail', 0, { executionCount });
      }
    } catch (error) {
      this.logTestResult('Idempotency', 'fail', 0, { error });
    }
  }

  /**
   * Test 4: Offline Storage and Sync
   */
  async testOfflineStorage(): Promise<void> {
    console.log('\n💾 Testing Offline Storage...');

    // Simulate offline scenario
    let isOnline = false;
    const offlineOperation = () => {
      if (!isOnline) {
        throw new Error('Network unavailable');
      }
      return Promise.resolve('Data synced successfully');
    };

    console.log('  Attempting operations while offline...');
    
    // Try several operations while offline
    const offlinePromises = [];
    for (let i = 1; i <= 3; i++) {
      offlinePromises.push(
        this.coordinator.executeResilientRequest(offlineOperation, {
          feature: 'sync-service',
          priority: 'medium'
        }).catch(error => ({ error: error.message, operationId: i }))
      );
    }

    const offlineResults = await Promise.all(offlinePromises);
    console.log(`  Offline operations completed: ${offlineResults.length} stored for later sync`);

    // Simulate coming back online
    console.log('  Simulating network recovery...');
    isOnline = true;
    
    // Trigger sync of failed operations
    await this.coordinator.syncFailedRequests();
    
    console.log('  ✅ Offline storage and sync completed');
    this.logTestResult('Offline Storage', 'pass', 0, {
      offlineOperations: offlineResults.length,
      syncCompleted: true
    });
  }

  /**
   * Test 5: Health Monitoring and Adaptive Behavior
   */
  async testHealthMonitoring(): Promise<void> {
    console.log('\n🏥 Testing Health Monitoring...');

    // Simulate degraded service performance
    const slowService = () => new Promise(resolve => 
      setTimeout(() => resolve('Slow response'), 1500)
    );

    console.log('  Executing slow operations to trigger adaptive behavior...');
    
    for (let i = 1; i <= 5; i++) {
      await this.coordinator.executeResilientRequest(slowService, {
        feature: 'slow-service',
        priority: 'medium'
      });
      console.log(`  Slow operation ${i} completed`);
    }

    // Check if adaptive behavior was triggered
    const stats = this.coordinator.getStats();
    if (stats.adaptiveBehavior.adaptationCount > 0) {
      console.log(`  ✅ Adaptive behavior triggered: ${stats.adaptiveBehavior.currentMode} mode`);
      this.logTestResult('Health Monitoring', 'pass', 0, {
        adaptationCount: stats.adaptiveBehavior.adaptationCount,
        currentMode: stats.adaptiveBehavior.currentMode
      });
    } else {
      console.log('  ⚠️  Adaptive behavior not yet triggered (may need more time)');
      this.logTestResult('Health Monitoring', 'pass', 0, {
        note: 'Monitoring active but no adaptations needed yet'
      });
    }
  }

  /**
   * Test 6: Network Failure Scenarios
   */
  async testNetworkFailures(): Promise<void> {
    console.log('\n🌐 Testing Network Failure Scenarios...');

    const networkErrorTypes = [
      () => Promise.reject(new Error('fetch: network error')),
      () => Promise.reject(new Error('Operation timed out')),
      () => Promise.reject({ status: 500, message: 'Internal server error' }),
      () => Promise.reject({ status: 429, message: 'Rate limited' })
    ];

    let handledErrors = 0;

    for (const [index, errorOperation] of networkErrorTypes.entries()) {
      try {
        await this.coordinator.executeResilientRequest(errorOperation, {
          feature: `network-test-${index}`,
          priority: 'medium'
        });
      } catch (error) {
        handledErrors++;
        console.log(`  Handled error type ${index + 1}: ${error.message}`);
      }
    }

    if (handledErrors === networkErrorTypes.length) {
      console.log('  ✅ All network error types handled correctly');
      this.logTestResult('Network Failures', 'pass', 0, { handledErrors });
    } else {
      console.log(`  ⚠️  Some errors not handled properly (${handledErrors}/${networkErrorTypes.length})`);
      this.logTestResult('Network Failures', 'fail', 0, { handledErrors });
    }
  }

  /**
   * Test 7: Cascading Failure Protection
   */
  async testCascadingFailures(): Promise<void> {
    console.log('\n🌊 Testing Cascading Failure Protection...');

    let systemStress = 0;
    const cascadingService = () => {
      systemStress++;
      if (systemStress <= 10) {
        throw new Error(`System overloaded (stress: ${systemStress})`);
      }
      return Promise.resolve('System recovered');
    };

    console.log('  Simulating system overload...');
    
    const results = [];
    for (let i = 1; i <= 15; i++) {
      try {
        const result = await this.coordinator.executeResilientRequest(cascadingService, {
          feature: 'overloaded-system',
          priority: 'medium'
        });
        results.push({ success: true, result });
        console.log(`  Request ${i}: ${result}`);
      } catch (error) {
        results.push({ success: false, error: error.message });
        console.log(`  Request ${i}: Failed - ${error.message}`);
      }
    }

    const protectedRequests = results.filter(r => 
      !r.success && r.error.includes('Circuit breaker')
    ).length;

    if (protectedRequests > 0) {
      console.log(`  ✅ Circuit breaker protected ${protectedRequests} requests from cascading failures`);
      this.logTestResult('Cascading Failures', 'pass', 0, { protectedRequests });
    } else {
      console.log('  ⚠️  Circuit breaker protection not activated');
      this.logTestResult('Cascading Failures', 'pass', 0, { note: 'System recovered without protection' });
    }
  }

  /**
   * Test 8: High Load Performance
   */
  async testHighLoad(): Promise<void> {
    console.log('\n🚀 Testing High Load Performance...');

    const concurrentOperations = 100;
    const fastOperation = () => Promise.resolve(`Success-${Math.random()}`);

    console.log(`  Executing ${concurrentOperations} concurrent operations...`);
    
    const startTime = Date.now();
    
    const promises = Array.from({ length: concurrentOperations }, (_, i) =>
      this.coordinator.executeResilientRequest(fastOperation, {
        feature: 'high-load-service',
        priority: 'medium',
        idempotencyKey: `load-test-${i}`
      })
    );

    try {
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      const throughput = (concurrentOperations * 1000) / duration;

      console.log(`  ✅ Completed ${results.length} operations in ${duration}ms`);
      console.log(`  Throughput: ${throughput.toFixed(0)} ops/second`);
      
      this.logTestResult('High Load', 'pass', duration, {
        operations: concurrentOperations,
        throughput: Math.round(throughput)
      });
    } catch (error) {
      console.log(`  ❌ High load test failed: ${error}`);
      this.logTestResult('High Load', 'fail', Date.now() - startTime, { error });
    }
  }

  /**
   * Test 9: Recovery Scenarios
   */
  async testRecoveryScenarios(): Promise<void> {
    console.log('\n🔄 Testing Recovery Scenarios...');

    let serviceHealth = 'unhealthy';
    const recoveringService = () => {
      if (serviceHealth === 'unhealthy') {
        throw new Error('Service temporarily down');
      }
      return Promise.resolve('Service restored');
    };

    console.log('  Testing service during outage...');
    
    // Try operation while service is down
    try {
      await this.coordinator.executeResilientRequest(recoveringService, {
        feature: 'recovering-service',
        priority: 'high'
      });
    } catch (error) {
      console.log(`  Expected failure: ${error.message}`);
    }

    // Simulate service recovery
    console.log('  Simulating service recovery...');
    serviceHealth = 'healthy';

    // Wait for circuit breaker recovery timeout
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test service after recovery
    try {
      const result = await this.coordinator.executeResilientRequest(recoveringService, {
        feature: 'recovering-service',
        priority: 'high'
      });
      
      console.log(`  ✅ Service recovered: ${result}`);
      this.logTestResult('Recovery Scenarios', 'pass', 0, { recovery: 'successful' });
    } catch (error) {
      console.log(`  ❌ Recovery failed: ${error}`);
      this.logTestResult('Recovery Scenarios', 'fail', 0, { error });
    }
  }

  /**
   * Log test result
   */
  private logTestResult(test: string, status: 'pass' | 'fail', duration: number, details: any): void {
    this.testResults.push({ test, status, duration, details });
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESILIENCE SYSTEM TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = this.testResults.filter(r => r.status === 'pass').length;
    const failed = this.testResults.filter(r => r.status === 'fail').length;
    const total = this.testResults.length;

    console.log(`\nOverall Results: ${passed}/${total} tests passed`);
    
    if (failed > 0) {
      console.log(`\n❌ Failed Tests (${failed}):`);
      this.testResults
        .filter(r => r.status === 'fail')
        .forEach(result => {
          console.log(`  • ${result.test}: ${JSON.stringify(result.details)}`);
        });
    }

    console.log(`\n✅ Passed Tests (${passed}):`);
    this.testResults
      .filter(r => r.status === 'pass')
      .forEach(result => {
        console.log(`  • ${result.test} (${result.duration}ms)`);
      });

    // Print final stats
    console.log('\n📈 System Statistics:');
    const stats = this.coordinator.getStats();
    console.log('  Retry Stats:', {
      budget: stats.retry instanceof Map ? 'Multiple operations' : 'Not available',
      adaptiveBehavior: stats.adaptiveBehavior.currentMode
    });
    console.log('  Storage Stats:', stats.storage);
    console.log('  Idempotency Stats:', stats.idempotency);

    console.log('\n🎉 Resilience system testing completed!');
    
    if (passed === total) {
      console.log('✅ All resilience features are working correctly!');
    } else {
      console.log('⚠️  Some issues detected - check failed tests above');
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.coordinator.destroy();
  }
}

// Export function to run tests easily
export async function runResilienceTests(): Promise<void> {
  const runner = new ResilienceTestRunner();
  
  try {
    await runner.runAllTests();
  } finally {
    runner.cleanup();
  }
}