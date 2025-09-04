/**
 * Comprehensive Resilience Testing Suite
 * Tests all resilience components and their integration
 */

import { RetryManager } from '../retry-manager';
import { CircuitBreakerManager } from '../circuit-breaker';
import { ResilientStorage } from '../resilient-storage';
import { MultiRegionalHealthMonitor } from '../health-monitor';
import { IntelligentSyncManager } from '../sync-manager';
import { IdempotencyManager } from '../idempotency-manager';
import { ResilienceCoordinator } from '../resilience-coordinator';

// Mock implementations for testing
class MockStorage implements Storage {
  private data = new Map<string, string>();
  
  get length(): number { return this.data.size; }
  
  clear(): void { this.data.clear(); }
  
  getItem(key: string): string | null {
    return this.data.get(key) || null;
  }
  
  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] || null;
  }
  
  removeItem(key: string): void {
    this.data.delete(key);
  }
  
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

// Setup mock environment
(global as any).localStorage = new MockStorage();
(global as any).sessionStorage = new MockStorage();
(global as any).indexedDB = {
  open: () => Promise.resolve({
    transaction: () => ({
      objectStore: () => ({
        put: () => Promise.resolve(),
        get: () => Promise.resolve({ result: null }),
        delete: () => Promise.resolve(),
        getAll: () => Promise.resolve([])
      })
    })
  })
};

describe('Resilience System Tests', () => {
  
  describe('RetryManager', () => {
    let retryManager: RetryManager;

    beforeEach(() => {
      retryManager = new RetryManager({
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000
      });
    });

    test('should retry failed operations with exponential backoff', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Network error');
        }
        return Promise.resolve('success');
      });

      const startTime = Date.now();
      const result = await retryManager.executeWithRetry('test-op', operation);
      const duration = Date.now() - startTime;

      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
      expect(duration).toBeGreaterThan(200); // Should have some delay
    });

    test('should respect retry budget limits', async () => {
      const retryManager = new RetryManager({
        maxAttempts: 5,
        retryBudget: 2
      });

      const failingOperation = () => Promise.reject(new Error('Server error'));

      // First operation should consume budget
      await expect(
        retryManager.executeWithRetry('op1', failingOperation, { priority: 'medium' })
      ).rejects.toThrow();

      // Second operation should consume remaining budget
      await expect(
        retryManager.executeWithRetry('op2', failingOperation, { priority: 'medium' })
      ).rejects.toThrow();

      // Third operation should be rejected due to budget exhaustion
      await expect(
        retryManager.executeWithRetry('op3', failingOperation, { priority: 'medium' })
      ).rejects.toThrow('Retry budget exceeded');
    });

    test('should handle request deduplication', async () => {
      let executionCount = 0;
      const operation = () => {
        executionCount++;
        return Promise.resolve(`result-${executionCount}`);
      };

      // Start multiple concurrent requests with same deduplication key
      const promises = [
        retryManager.executeWithRetry('op', operation, { deduplicationKey: 'same-key' }),
        retryManager.executeWithRetry('op', operation, { deduplicationKey: 'same-key' }),
        retryManager.executeWithRetry('op', operation, { deduplicationKey: 'same-key' })
      ];

      const results = await Promise.all(promises);

      expect(executionCount).toBe(1); // Operation should only execute once
      expect(results).toEqual(['result-1', 'result-1', 'result-1']);
    });
  });

  describe('CircuitBreakerManager', () => {
    let circuitBreakerManager: CircuitBreakerManager;

    beforeEach(() => {
      circuitBreakerManager = new CircuitBreakerManager({
        failureThreshold: 3,
        recoveryTimeout: 1000,
        successThreshold: 2
      });
    });

    test('should open circuit after failure threshold', async () => {
      const failingOperation = () => Promise.reject(new Error('Service error'));

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreakerManager.executeWithBreaker('test-service', failingOperation)
        ).rejects.toThrow('Service error');
      }

      // Circuit should now be open
      await expect(
        circuitBreakerManager.executeWithBreaker('test-service', failingOperation)
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    test('should transition to half-open after recovery timeout', async () => {
      const failingOperation = () => Promise.reject(new Error('Service error'));
      const successOperation = () => Promise.resolve('success');

      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreakerManager.executeWithBreaker('test-service', failingOperation)
        ).rejects.toThrow();
      }

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be in half-open state and allow one request
      const result = await circuitBreakerManager.executeWithBreaker('test-service', successOperation);
      expect(result).toBe('success');
    });

    test('should provide graceful degradation', async () => {
      const degradedResponse = { data: 'cached', degraded: true };
      
      const result = await circuitBreakerManager.executeWithBreaker(
        'test-service',
        () => Promise.reject(new Error('Service error')),
        { degradeGracefully: true, degradedResponse }
      );

      expect(result).toEqual(degradedResponse);
    });
  });

  describe('ResilientStorage', () => {
    let storage: ResilientStorage;

    beforeEach(() => {
      storage = new ResilientStorage({
        quotas: {
          hot: { maxItems: 10, maxSizeBytes: 1000 },
          warm: { maxItems: 50, maxSizeBytes: 5000 },
          cold: { maxItems: 100, maxSizeBytes: 10000 }
        }
      });
    });

    test('should store data in appropriate tiers based on priority', async () => {
      await storage.storeData('critical-data', { important: true }, { 
        priority: 'critical',
        tier: 'hot'
      });

      await storage.storeData('normal-data', { normal: true }, {
        priority: 'medium',
        tier: 'warm'
      });

      const criticalData = await storage.getData('critical-data');
      const normalData = await storage.getData('normal-data');

      expect(criticalData).toEqual({ important: true });
      expect(normalData).toEqual({ normal: true });
    });

    test('should compress large data automatically', async () => {
      const largeData = { content: 'x'.repeat(1000) };
      
      await storage.storeData('large-data', largeData, {
        priority: 'medium',
        compress: true
      });

      const retrieved = await storage.getData('large-data');
      expect(retrieved).toEqual(largeData);
    });

    test('should enforce storage quotas', async () => {
      // Fill up hot tier
      for (let i = 0; i < 15; i++) {
        await storage.storeData(`item-${i}`, { data: i }, {
          priority: 'high',
          tier: 'hot'
        });
      }

      const stats = storage.getStats();
      expect(stats.tierUsage.hot.itemCount).toBeLessThanOrEqual(10);
    });
  });

  describe('MultiRegionalHealthMonitor', () => {
    let healthMonitor: MultiRegionalHealthMonitor;

    beforeEach(() => {
      healthMonitor = new MultiRegionalHealthMonitor({
        regions: ['us-east-1', 'eu-west-1'],
        endpoints: {
          'api-service': 'https://api.example.com/health',
          'auth-service': 'https://auth.example.com/health'
        },
        healthCheckInterval: 1000
      });
    });

    afterEach(() => {
      healthMonitor.destroy();
    });

    test('should monitor endpoint health', async () => {
      // Mock successful health check
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' })
      });

      await new Promise(resolve => setTimeout(resolve, 1100));

      const health = healthMonitor.getEndpointHealth('api-service');
      expect(health?.isHealthy).toBe(true);
    });

    test('should detect unhealthy endpoints', async () => {
      // Mock failed health check
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await new Promise(resolve => setTimeout(resolve, 1100));

      const health = healthMonitor.getEndpointHealth('api-service');
      expect(health?.isHealthy).toBe(false);
    });

    test('should provide adaptive recommendations', async () => {
      // Simulate degraded performance
      healthMonitor.recordRequest('api-service', 'us-east-1', true, 3000);
      healthMonitor.recordRequest('api-service', 'us-east-1', true, 3500);

      const recommendation = healthMonitor.getAdaptiveRecommendation('api-service', 'us-east-1');
      
      expect(recommendation).toBeDefined();
      expect(recommendation.adjustedTimeout).toBeGreaterThan(3000);
    });
  });

  describe('IdempotencyManager', () => {
    let idempotencyManager: IdempotencyManager;

    beforeEach(() => {
      idempotencyManager = new IdempotencyManager({
        keyTTL: 5000,
        enableResponseCaching: true,
        responseCacheTTL: 1000
      });
    });

    test('should prevent duplicate operations', async () => {
      let executionCount = 0;
      const operation = () => {
        executionCount++;
        return Promise.resolve(`result-${executionCount}`);
      };

      // Execute same operation multiple times concurrently
      const promises = [
        idempotencyManager.executeIdempotent('same-key', operation),
        idempotencyManager.executeIdempotent('same-key', operation),
        idempotencyManager.executeIdempotent('same-key', operation)
      ];

      const results = await Promise.all(promises);

      expect(executionCount).toBe(1);
      expect(results).toEqual(['result-1', 'result-1', 'result-1']);
    });

    test('should cache successful responses', async () => {
      let executionCount = 0;
      const operation = () => {
        executionCount++;
        return Promise.resolve(`result-${executionCount}`);
      };

      // First execution
      const result1 = await idempotencyManager.executeIdempotent('cache-key', operation);
      
      // Second execution should use cached result
      const result2 = await idempotencyManager.executeIdempotent('cache-key', operation);

      expect(executionCount).toBe(1);
      expect(result1).toBe(result2);
    });

    test('should generate appropriate idempotency keys', () => {
      const key1 = idempotencyManager.generateIdempotencyKey(
        'POST',
        '/api/errors',
        { error: 'test' },
        'user123'
      );

      const key2 = idempotencyManager.generateIdempotencyKey(
        'POST',
        '/api/errors',
        { error: 'test' },
        'user123'
      );

      expect(key1).toBe(key2);
    });
  });

  describe('IntelligentSyncManager', () => {
    let syncManager: IntelligentSyncManager;

    beforeEach(() => {
      syncManager = new IntelligentSyncManager({
        maxConcurrentSyncs: 2,
        batchSizes: {
          critical: 10,
          high: 25,
          medium: 50,
          low: 100
        }
      });
    });

    afterEach(() => {
      syncManager.destroy();
    });

    test('should batch sync operations by priority', async () => {
      const items = [
        { id: '1', data: { test: 1 }, priority: 'high' as const, size: 100, timestamp: Date.now(), dependencies: [] },
        { id: '2', data: { test: 2 }, priority: 'high' as const, size: 100, timestamp: Date.now(), dependencies: [] },
        { id: '3', data: { test: 3 }, priority: 'low' as const, size: 100, timestamp: Date.now(), dependencies: [] }
      ];

      let batchCount = 0;
      const syncOperation = async (batch: any[]) => {
        batchCount++;
        return { success: true, processedIds: batch.map(item => item.id) };
      };

      await syncManager.performIntelligentSync('test-sync', items, {
        maxBatchSize: 2,
        syncOperation
      });

      // Should create multiple batches for different priorities
      expect(batchCount).toBeGreaterThan(1);
    });

    test('should handle sync failures with retry', async () => {
      const items = [
        { id: '1', data: { test: 1 }, priority: 'medium' as const, size: 100, timestamp: Date.now(), dependencies: [] }
      ];

      let attempts = 0;
      const syncOperation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Sync failed');
        }
        return { success: true, processedIds: ['1'] };
      };

      const result = await syncManager.performIntelligentSync('test-sync', items, {
        syncOperation,
        retryFailedItems: true
      });

      expect(attempts).toBe(2);
      expect(result.processedItems).toBe(1);
    });
  });

  describe('ResilienceCoordinator Integration', () => {
    let coordinator: ResilienceCoordinator;

    beforeEach(() => {
      coordinator = new ResilienceCoordinator({
        enableAdaptiveBehavior: true,
        performanceThresholds: {
          slowRequestMs: 1000,
          verySlowRequestMs: 2000,
          highErrorRate: 0.2,
          criticalErrorRate: 0.5
        }
      });
    });

    afterEach(() => {
      coordinator.destroy();
    });

    test('should coordinate all resilience components', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await coordinator.executeResilientRequest(mockOperation, {
        feature: 'test-feature',
        priority: 'high',
        timeout: 5000,
        idempotencyKey: 'test-key'
      });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
    });

    test('should adapt behavior based on performance', async () => {
      // Simulate poor performance to trigger degraded mode
      const slowOperation = () => new Promise(resolve => 
        setTimeout(() => resolve('slow-result'), 1500)
      );

      // Execute multiple slow operations
      for (let i = 0; i < 5; i++) {
        await coordinator.executeResilientRequest(slowOperation, {
          feature: 'slow-service',
          priority: 'medium'
        });
      }

      // Check if adaptive behavior kicked in
      const stats = coordinator.getStats();
      expect(stats.adaptiveBehavior.adaptationCount).toBeGreaterThan(0);
    });

    test('should handle failed requests by storing for later sync', async () => {
      const failingOperation = () => Promise.reject(new Error('Network error'));

      await expect(
        coordinator.executeResilientRequest(failingOperation, {
          feature: 'unreliable-service',
          priority: 'medium'
        })
      ).rejects.toThrow('Network error');

      // Should have stored the failed request
      const stats = coordinator.getStats();
      expect(stats.storage.totalItems).toBeGreaterThan(0);
    });

    test('should provide comprehensive statistics', () => {
      const stats = coordinator.getStats();

      expect(stats).toHaveProperty('retry');
      expect(stats).toHaveProperty('circuitBreaker');
      expect(stats).toHaveProperty('storage');
      expect(stats).toHaveProperty('healthMonitor');
      expect(stats).toHaveProperty('sync');
      expect(stats).toHaveProperty('idempotency');
      expect(stats).toHaveProperty('adaptiveBehavior');
    });
  });

  describe('End-to-End Resilience Scenarios', () => {
    let coordinator: ResilienceCoordinator;

    beforeEach(() => {
      coordinator = new ResilienceCoordinator();
    });

    afterEach(() => {
      coordinator.destroy();
    });

    test('should handle cascading failures gracefully', async () => {
      let failureCount = 0;
      const cascadingFailure = () => {
        failureCount++;
        if (failureCount <= 5) {
          throw new Error('Service temporarily unavailable');
        }
        return Promise.resolve('recovered');
      };

      // Should eventually succeed after failures trigger protective mechanisms
      const result = await coordinator.executeResilientRequest(cascadingFailure, {
        feature: 'critical-service',
        priority: 'critical',
        timeout: 10000
      });

      expect(result).toBe('recovered');
      expect(failureCount).toBeGreaterThan(1);
    });

    test('should maintain data consistency during network partitions', async () => {
      const operations = [];
      
      // Simulate network partition where some requests fail
      for (let i = 0; i < 10; i++) {
        const operation = i % 3 === 0 
          ? () => Promise.reject(new Error('Network partition'))
          : () => Promise.resolve(`success-${i}`);

        operations.push(
          coordinator.executeResilientRequest(operation, {
            feature: 'data-service',
            priority: 'high',
            idempotencyKey: `op-${i}`
          }).catch(error => ({ error: error.message }))
        );
      }

      const results = await Promise.all(operations);
      
      // Should have some successes and some stored failures
      const successes = results.filter(r => typeof r === 'string' && r.startsWith('success'));
      const failures = results.filter(r => r.error);

      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);

      // Failed operations should be stored for later sync
      const stats = coordinator.getStats();
      expect(stats.storage.totalItems).toBeGreaterThan(0);
    });

    test('should recover from prolonged outages', async () => {
      let outageActive = true;
      
      // Simulate outage that resolves after some time
      setTimeout(() => { outageActive = false; }, 2000);

      const outagePronOperation = () => {
        if (outageActive) {
          throw new Error('Service outage');
        }
        return Promise.resolve('service-restored');
      };

      // This should eventually succeed when outage ends
      const result = await coordinator.executeResilientRequest(outagePronOperation, {
        feature: 'outage-service',
        priority: 'high',
        timeout: 15000
      });

      expect(result).toBe('service-restored');
    });
  });

  describe('Performance and Memory Tests', () => {
    test('should not leak memory during high-volume operations', async () => {
      const coordinator = new ResilienceCoordinator();
      
      // Simulate high-volume operations
      const operations = [];
      for (let i = 0; i < 1000; i++) {
        operations.push(
          coordinator.executeResilientRequest(
            () => Promise.resolve(`result-${i}`),
            {
              feature: 'high-volume-service',
              priority: 'medium',
              idempotencyKey: `vol-op-${i}`
            }
          )
        );
      }

      await Promise.all(operations);

      const stats = coordinator.getStats();
      
      // Memory usage should be reasonable
      expect(stats.idempotency.memoryUsage).toBeLessThan(500);
      expect(stats.storage.totalItems).toBeLessThan(100);

      coordinator.destroy();
    });

    test('should maintain performance under concurrent load', async () => {
      const coordinator = new ResilienceCoordinator();
      
      const startTime = Date.now();
      
      // Run concurrent operations
      const concurrentOps = Array.from({ length: 100 }, (_, i) =>
        coordinator.executeResilientRequest(
          () => new Promise(resolve => setTimeout(() => resolve(`result-${i}`), 50)),
          {
            feature: 'concurrent-service',
            priority: 'medium'
          }
        )
      );

      const results = await Promise.all(concurrentOps);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(100);
      expect(duration).toBeLessThan(5000); // Should complete in reasonable time
      
      coordinator.destroy();
    });
  });
});