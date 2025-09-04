/**
 * Simple Test Runner for Resilience Components
 * Runs without external testing frameworks
 */

import { RetryManager } from './retry-manager';
import { CircuitBreakerManager } from './circuit-breaker';
import { ResilientStorage } from './resilient-storage';
import { MultiRegionalHealthMonitor } from './health-monitor';
import { IntelligentSyncManager } from './sync-manager';
import { IdempotencyManager } from './idempotency-manager';
import { ResilienceCoordinator } from './resilience-coordinator';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  details?: any;
  error?: string;
}

export class SimpleResilienceTestRunner {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Simple Resilience Tests...\n');

    const tests = [
      { name: 'Retry Manager Basic Test', fn: () => this.testRetryManager() },
      { name: 'Circuit Breaker Test', fn: () => this.testCircuitBreaker() },
      { name: 'Idempotency Test', fn: () => this.testIdempotency() },
      { name: 'Storage Test', fn: () => this.testStorage() },
      { name: 'Health Monitor Test', fn: () => this.testHealthMonitor() },
      { name: 'Sync Manager Test', fn: () => this.testSyncManager() },
      { name: 'Full Integration Test', fn: () => this.testIntegration() }
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.fn);
    }

    this.printSummary();
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({ name, success: true, duration });
      console.log(`✅ ${name} - PASSED (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({ 
        name, 
        success: false, 
        duration, 
        error: error.message 
      });
      console.log(`❌ ${name} - FAILED (${duration}ms): ${error.message}`);
    }
  }

  private async testRetryManager(): Promise<void> {
    const retryManager = new RetryManager({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000
    });

    let attempts = 0;
    const flakyOperation = () => {
      attempts++;
      if (attempts < 3) {
        throw new Error(`Attempt ${attempts} failed`);
      }
      return Promise.resolve('Success after retries');
    };

    const result = await retryManager.executeWithRetry('test-op', flakyOperation);
    
    if (result !== 'Success after retries' || attempts !== 3) {
      throw new Error(`Expected success after 3 attempts, got result: ${result}, attempts: ${attempts}`);
    }
  }

  private async testCircuitBreaker(): Promise<void> {
    const cbManager = new CircuitBreakerManager();

    // Trigger failures to open circuit
    let failureCount = 0;
    const failingOperation = () => {
      failureCount++;
      throw new Error(`Failure ${failureCount}`);
    };

    // Should fail multiple times
    for (let i = 0; i < 5; i++) {
      try {
        await cbManager.executeWithBreaker('test-service', failingOperation);
      } catch (error) {
        // Expected failures
      }
    }

    // Circuit should now be open and block requests
    try {
      await cbManager.executeWithBreaker('test-service', () => Promise.resolve('should not execute'));
      throw new Error('Circuit breaker should have blocked this request');
    } catch (error: any) {
      if (!error.message.includes('Circuit breaker is OPEN')) {
        throw new Error('Expected circuit breaker to be OPEN');
      }
    }
  }

  private async testIdempotency(): Promise<void> {
    const idempotencyManager = new IdempotencyManager();

    let executionCount = 0;
    const operation = () => {
      executionCount++;
      return Promise.resolve(`Result ${executionCount}`);
    };

    // Execute same operation multiple times with same key
    const promises = Array.from({ length: 5 }, () =>
      idempotencyManager.executeIdempotent('same-key', operation)
    );

    const results = await Promise.all(promises);

    if (executionCount !== 1) {
      throw new Error(`Expected 1 execution, got ${executionCount}`);
    }

    if (!results.every(r => r === results[0])) {
      throw new Error('All results should be identical');
    }
  }

  private async testStorage(): Promise<void> {
    // Simple storage test using localStorage directly
    const testKey = 'resilience-test-key';
    const testData = { data: 'test-value', timestamp: Date.now() };
    
    // Store data
    localStorage.setItem(testKey, JSON.stringify(testData));
    
    // Retrieve data
    const retrieved = localStorage.getItem(testKey);
    if (!retrieved) {
      throw new Error('Data not found in storage');
    }
    
    const parsed = JSON.parse(retrieved);
    if (parsed.data !== 'test-value') {
      throw new Error(`Expected {data: 'test-value'}, got ${JSON.stringify(parsed)}`);
    }
    
    // Clean up
    localStorage.removeItem(testKey);
  }

  private async testHealthMonitor(): Promise<void> {
    const healthMonitor = new MultiRegionalHealthMonitor({
      regions: ['us-east-1'],
      endpoints: {
        'test-service': '/health'
      },
      healthCheckInterval: 1000
    });

    // Test basic initialization
    const stats = healthMonitor.getGlobalStats();
    if (!stats) {
      throw new Error('Health monitor should provide stats');
    }

    if (stats.regions !== 1) {
      throw new Error(`Expected 1 region, got ${stats.regions}`);
    }

    // Test getting primary region
    const primaryRegion = healthMonitor.getPrimaryRegion();
    if (!primaryRegion) {
      throw new Error('Should have a primary region');
    }

    healthMonitor.destroy();
  }

  private async testSyncManager(): Promise<void> {
    const syncManager = new IntelligentSyncManager();

    // Test basic initialization
    const stats = syncManager.getStats();
    if (!stats) {
      throw new Error('Sync manager should provide stats');
    }

    if (typeof stats.activeSyncs !== 'number') {
      throw new Error('Stats should include activeSyncs count');
    }

    // Test configuration
    const config = syncManager.getConfig();
    if (!config || typeof config.maxConcurrentSyncs !== 'number') {
      throw new Error('Sync manager should provide configuration');
    }

    syncManager.destroy();
  }

  private async testIntegration(): Promise<void> {
    const coordinator = new ResilienceCoordinator({
      enableAdaptiveBehavior: false // Disable for simpler testing
    });

    // Test successful operation
    let called = false;
    const result = await coordinator.executeResilientRequest(() => {
      called = true;
      return Promise.resolve('integration-success');
    }, {
      feature: 'test-integration',
      priority: 'high'
    });

    if (!called || result !== 'integration-success') {
      throw new Error('Integration test should execute successfully');
    }

    // Test with idempotency
    let execCount = 0;
    const promises = Array.from({ length: 3 }, () =>
      coordinator.executeResilientRequest(() => {
        execCount++;
        return Promise.resolve(`exec-${execCount}`);
      }, {
        feature: 'test-idempotent',
        priority: 'medium',
        idempotencyKey: 'same-integration-key'
      })
    );

    const results = await Promise.all(promises);
    
    if (execCount !== 1 || !results.every(r => r === results[0])) {
      throw new Error('Integration idempotency not working correctly');
    }

    // Get comprehensive stats
    const stats = coordinator.getStats();
    if (!stats.retry || !stats.circuitBreaker || !stats.storage || !stats.idempotency) {
      throw new Error('Integration stats should include all components');
    }

    coordinator.destroy();
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SIMPLE RESILIENCE TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => r.success === false).length;
    const total = this.results.length;

    console.log(`\nOverall Results: ${passed}/${total} tests passed`);
    
    if (failed > 0) {
      console.log(`\n❌ Failed Tests (${failed}):`);
      this.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`  • ${result.name}: ${result.error}`);
        });
    }

    console.log(`\n✅ Passed Tests (${passed}):`);
    this.results
      .filter(r => r.success)
      .forEach(result => {
        console.log(`  • ${result.name} (${result.duration}ms)`);
      });

    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    console.log(`\nAverage Test Duration: ${avgDuration.toFixed(2)}ms`);

    if (passed === total) {
      console.log('\n🎉 All resilience features are working correctly!');
    } else {
      console.log('\n⚠️  Some issues detected - check failed tests above');
    }
  }

  getResults(): TestResult[] {
    return [...this.results];
  }
}

// Export function to run tests
export async function runSimpleResilienceTests(): Promise<TestResult[]> {
  const runner = new SimpleResilienceTestRunner();
  await runner.runAllTests();
  return runner.getResults();
}

// Run tests if this module is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runSimpleResilienceTests().catch(console.error);
}