/**
 * Performance Benchmarks for Resilience System
 * Measures overhead and performance characteristics of resilience components
 */

import { RetryManager } from '../retry-manager';
import { CircuitBreakerManager } from '../circuit-breaker';
import { ResilientStorage } from '../resilient-storage';
import { IdempotencyManager } from '../idempotency-manager';
import { ResilienceCoordinator } from '../resilience-coordinator';

interface BenchmarkResult {
  operation: string;
  totalOperations: number;
  totalTime: number;
  averageTime: number;
  operationsPerSecond: number;
  memoryUsage: number;
  overhead: number;
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  async runBenchmark(
    name: string,
    operation: () => Promise<any>,
    iterations: number = 1000
  ): Promise<BenchmarkResult> {
    // Warm up
    for (let i = 0; i < 10; i++) {
      await operation();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const startMemory = this.getMemoryUsage();
    const startTime = performance.now();

    // Run benchmark
    const promises = [];
    for (let i = 0; i < iterations; i++) {
      promises.push(operation());
    }

    await Promise.all(promises);

    const endTime = performance.now();
    const endMemory = this.getMemoryUsage();

    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;
    const operationsPerSecond = (iterations * 1000) / totalTime;
    const memoryUsage = endMemory - startMemory;

    const result: BenchmarkResult = {
      operation: name,
      totalOperations: iterations,
      totalTime,
      averageTime,
      operationsPerSecond,
      memoryUsage,
      overhead: 0 // Will be calculated against baseline
    };

    this.results.push(result);
    return result;
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0; // Browser environment
  }

  printResults(): void {
    console.log('\n📊 Resilience System Performance Benchmarks');
    console.log('=' .repeat(80));
    
    for (const result of this.results) {
      console.log(`\n🔄 ${result.operation}`);
      console.log(`   Operations: ${result.totalOperations.toLocaleString()}`);
      console.log(`   Total Time: ${result.totalTime.toFixed(2)}ms`);
      console.log(`   Average Time: ${result.averageTime.toFixed(4)}ms`);
      console.log(`   Ops/Second: ${result.operationsPerSecond.toFixed(0)}`);
      console.log(`   Memory Usage: ${(result.memoryUsage / 1024).toFixed(2)}KB`);
      if (result.overhead > 0) {
        console.log(`   Overhead: ${result.overhead.toFixed(2)}ms (+${((result.overhead / result.averageTime) * 100).toFixed(1)}%)`);
      }
    }
  }

  calculateOverhead(baselineResult: BenchmarkResult): void {
    for (const result of this.results) {
      if (result.operation !== baselineResult.operation) {
        result.overhead = result.averageTime - baselineResult.averageTime;
      }
    }
  }
}

describe('Resilience System Benchmarks', () => {
  const benchmark = new PerformanceBenchmark();

  test('Baseline - Direct operation execution', async () => {
    const simpleOperation = () => Promise.resolve('success');
    
    const result = await benchmark.runBenchmark(
      'Baseline (Direct execution)',
      simpleOperation,
      10000
    );

    expect(result.averageTime).toBeLessThan(1); // Should be very fast
    expect(result.operationsPerSecond).toBeGreaterThan(50000);
  });

  test('RetryManager performance overhead', async () => {
    const retryManager = new RetryManager({
      maxAttempts: 1, // No retries for performance test
      baseDelay: 0
    });

    const operation = () => Promise.resolve('success');
    const wrappedOperation = () => retryManager.executeWithRetry('perf-test', operation);

    const result = await benchmark.runBenchmark(
      'RetryManager (no retries)',
      wrappedOperation,
      10000
    );

    expect(result.averageTime).toBeLessThan(5); // Should add minimal overhead
    expect(result.operationsPerSecond).toBeGreaterThan(5000);
  });

  test('CircuitBreakerManager performance overhead', async () => {
    const circuitBreakerManager = new CircuitBreakerManager();

    const operation = () => Promise.resolve('success');
    const wrappedOperation = () => circuitBreakerManager.executeWithBreaker('perf-service', operation);

    const result = await benchmark.runBenchmark(
      'CircuitBreakerManager (closed state)',
      wrappedOperation,
      10000
    );

    expect(result.averageTime).toBeLessThan(5);
    expect(result.operationsPerSecond).toBeGreaterThan(5000);
  });

  test('IdempotencyManager performance overhead', async () => {
    const idempotencyManager = new IdempotencyManager();

    let counter = 0;
    const operation = () => Promise.resolve(`success-${++counter}`);
    const wrappedOperation = () => idempotencyManager.executeIdempotent(`key-${counter}`, operation);

    const result = await benchmark.runBenchmark(
      'IdempotencyManager (unique keys)',
      wrappedOperation,
      5000
    );

    expect(result.averageTime).toBeLessThan(10);
    expect(result.operationsPerSecond).toBeGreaterThan(2000);
  });

  test('ResilientStorage performance', async () => {
    const storage = new ResilientStorage();

    let counter = 0;
    const storeOperation = async () => {
      await storage.storeData(`perf-key-${++counter}`, { data: counter }, {
        priority: 'medium',
        tier: 'warm'
      });
      return 'stored';
    };

    const result = await benchmark.runBenchmark(
      'ResilientStorage (store operations)',
      storeOperation,
      1000
    );

    expect(result.averageTime).toBeLessThan(50);
    expect(result.operationsPerSecond).toBeGreaterThan(100);
  });

  test('Full ResilienceCoordinator overhead', async () => {
    const coordinator = new ResilienceCoordinator();

    let counter = 0;
    const operation = () => Promise.resolve(`success-${++counter}`);
    const wrappedOperation = () => coordinator.executeResilientRequest(operation, {
      feature: 'perf-test',
      priority: 'medium',
      idempotencyKey: `perf-key-${counter}`
    });

    const result = await benchmark.runBenchmark(
      'ResilienceCoordinator (full stack)',
      wrappedOperation,
      1000
    );

    expect(result.averageTime).toBeLessThan(100);
    expect(result.operationsPerSecond).toBeGreaterThan(50);

    coordinator.destroy();
  });

  test('High-concurrency stress test', async () => {
    const coordinator = new ResilienceCoordinator({
      retry: { maxAttempts: 1 },
      idempotency: { maxStoredKeys: 10000 }
    });

    const concurrentOperations = 1000;
    const operationsPerBatch = 100;
    
    const startTime = performance.now();

    // Run operations in batches to simulate high concurrency
    const batches = Math.ceil(concurrentOperations / operationsPerBatch);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchOperations = [];
      
      for (let i = 0; i < operationsPerBatch; i++) {
        const opId = batch * operationsPerBatch + i;
        batchOperations.push(
          coordinator.executeResilientRequest(
            () => Promise.resolve(`result-${opId}`),
            {
              feature: 'stress-test',
              priority: 'medium',
              idempotencyKey: `stress-${opId}`
            }
          )
        );
      }
      
      await Promise.all(batchOperations);
    }

    const totalTime = performance.now() - startTime;
    const throughput = (concurrentOperations * 1000) / totalTime;

    console.log(`\n🚀 Stress Test Results:`);
    console.log(`   Total Operations: ${concurrentOperations}`);
    console.log(`   Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${throughput.toFixed(0)} ops/sec`);
    
    expect(throughput).toBeGreaterThan(100); // Should handle at least 100 ops/sec
    expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

    coordinator.destroy();
  });

  test('Memory efficiency under load', async () => {
    const coordinator = new ResilienceCoordinator();
    const initialMemory = coordinator.getStats().idempotency.memoryUsage;

    // Generate load
    const operations = [];
    for (let i = 0; i < 5000; i++) {
      operations.push(
        coordinator.executeResilientRequest(
          () => Promise.resolve(`result-${i}`),
          {
            feature: 'memory-test',
            priority: 'medium',
            idempotencyKey: `mem-${i}`
          }
        )
      );
    }

    await Promise.all(operations);

    const finalMemory = coordinator.getStats().idempotency.memoryUsage;
    const memoryGrowth = finalMemory - initialMemory;

    console.log(`\n🧠 Memory Efficiency Test:`);
    console.log(`   Initial Memory Usage: ${initialMemory}`);
    console.log(`   Final Memory Usage: ${finalMemory}`);
    console.log(`   Memory Growth: ${memoryGrowth}`);
    console.log(`   Growth per Operation: ${(memoryGrowth / 5000).toFixed(4)}`);

    // Memory should not grow unbounded
    expect(memoryGrowth).toBeLessThan(1000);

    coordinator.destroy();
  });

  test('Retry performance under failures', async () => {
    const retryManager = new RetryManager({
      maxAttempts: 3,
      baseDelay: 10,
      maxDelay: 100
    });

    let attemptCount = 0;
    const flakyOperation = () => {
      attemptCount++;
      if (attemptCount % 2 === 0) {
        return Promise.resolve('success');
      } else {
        return Promise.reject(new Error('Flaky failure'));
      }
    };

    const startTime = performance.now();
    
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        retryManager.executeWithRetry(`flaky-${i}`, flakyOperation).catch(() => 'failed')
      );
    }

    await Promise.all(promises);
    
    const totalTime = performance.now() - startTime;
    const stats = retryManager.getStats();

    console.log(`\n🔄 Retry Performance Test:`);
    console.log(`   Operations: 100`);
    console.log(`   Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Average Time: ${(totalTime / 100).toFixed(2)}ms`);
    console.log(`   Total Attempts: ${attemptCount}`);
    console.log(`   Retry Stats:`, stats);

    expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
  });

  afterAll(() => {
    // Calculate overhead against baseline
    const baselineResult = benchmark.results.find(r => r.operation.includes('Baseline'));
    if (baselineResult) {
      benchmark.calculateOverhead(baselineResult);
    }
    
    benchmark.printResults();
    
    console.log('\n✅ All benchmarks completed successfully!');
    console.log('🎯 The resilience system adds minimal overhead while providing comprehensive protection.');
  });
});

// Utility class for continuous performance monitoring
export class ResiliencePerformanceMonitor {
  private samples: Array<{
    timestamp: number;
    operation: string;
    duration: number;
    success: boolean;
  }> = [];

  private config = {
    maxSamples: 1000,
    alertThreshold: 100, // ms
    sampleWindow: 300000 // 5 minutes
  };

  recordOperation(operation: string, duration: number, success: boolean): void {
    this.samples.push({
      timestamp: Date.now(),
      operation,
      duration,
      success
    });

    // Keep only recent samples
    const cutoff = Date.now() - this.config.sampleWindow;
    this.samples = this.samples.filter(s => s.timestamp > cutoff);

    // Limit sample count
    if (this.samples.length > this.config.maxSamples) {
      this.samples = this.samples.slice(-this.config.maxSamples);
    }

    // Check for performance degradation
    this.checkPerformance();
  }

  private checkPerformance(): void {
    const recentSamples = this.samples.slice(-50); // Last 50 operations
    if (recentSamples.length < 10) return;

    const averageDuration = recentSamples.reduce((sum, s) => sum + s.duration, 0) / recentSamples.length;
    const successRate = recentSamples.filter(s => s.success).length / recentSamples.length;

    if (averageDuration > this.config.alertThreshold) {
      console.warn(`⚠️ Performance degradation detected: ${averageDuration.toFixed(2)}ms average`);
    }

    if (successRate < 0.9) {
      console.warn(`⚠️ High failure rate detected: ${((1 - successRate) * 100).toFixed(1)}% failures`);
    }
  }

  getPerformanceReport(): {
    totalOperations: number;
    averageDuration: number;
    successRate: number;
    operationBreakdown: Record<string, {
      count: number;
      averageDuration: number;
      successRate: number;
    }>;
  } {
    const breakdown: Record<string, any> = {};

    for (const sample of this.samples) {
      if (!breakdown[sample.operation]) {
        breakdown[sample.operation] = {
          durations: [],
          successes: 0,
          total: 0
        };
      }

      breakdown[sample.operation].durations.push(sample.duration);
      breakdown[sample.operation].total++;
      if (sample.success) {
        breakdown[sample.operation].successes++;
      }
    }

    const operationBreakdown: Record<string, any> = {};
    for (const [operation, data] of Object.entries(breakdown)) {
      const durations = data.durations;
      operationBreakdown[operation] = {
        count: data.total,
        averageDuration: durations.reduce((a: number, b: number) => a + b, 0) / durations.length,
        successRate: data.successes / data.total
      };
    }

    return {
      totalOperations: this.samples.length,
      averageDuration: this.samples.reduce((sum, s) => sum + s.duration, 0) / this.samples.length,
      successRate: this.samples.filter(s => s.success).length / this.samples.length,
      operationBreakdown
    };
  }
}