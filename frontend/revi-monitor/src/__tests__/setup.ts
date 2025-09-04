/**
 * Test setup for Vitest
 * Configures global test environment and mocks
 */

import { vi } from 'vitest';

// Mock localStorage and sessionStorage
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

// Mock browser APIs
Object.defineProperty(global, 'localStorage', {
  value: new MockStorage(),
  writable: true
});

Object.defineProperty(global, 'sessionStorage', {
  value: new MockStorage(),
  writable: true
});

// Mock IndexedDB
const mockIDBRequest = {
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

const mockIDBTransaction = {
  objectStore: vi.fn(() => ({
    put: vi.fn(() => mockIDBRequest),
    get: vi.fn(() => mockIDBRequest),
    delete: vi.fn(() => mockIDBRequest),
    getAll: vi.fn(() => mockIDBRequest),
    createIndex: vi.fn(),
    index: vi.fn()
  })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

const mockIDBDatabase = {
  transaction: vi.fn(() => mockIDBTransaction),
  createObjectStore: vi.fn(),
  deleteObjectStore: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

Object.defineProperty(global, 'indexedDB', {
  value: {
    open: vi.fn(() => ({
      ...mockIDBRequest,
      result: mockIDBDatabase
    })),
    deleteDatabase: vi.fn(() => mockIDBRequest),
    databases: vi.fn(() => Promise.resolve([]))
  },
  writable: true
});

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  },
  writable: true
});

// Mock fetch for health monitoring tests
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ status: 'healthy' }),
    text: () => Promise.resolve('healthy'),
    headers: new Headers()
  } as Response)
);

// Mock window object
Object.defineProperty(global, 'window', {
  value: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: ''
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (Test Environment) AppleWebKit/537.36',
      onLine: true
    },
    localStorage: global.localStorage,
    sessionStorage: global.sessionStorage,
    indexedDB: global.indexedDB,
    performance: global.performance,
    fetch: global.fetch
  },
  writable: true
});

// Mock console methods for cleaner test output
const originalConsole = { ...console };

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
  
  // Clear storage
  global.localStorage.clear();
  global.sessionStorage.clear();
  
  // Reset fetch mock
  (global.fetch as any).mockClear();
});

afterEach(() => {
  // Clean up any timers
  vi.clearAllTimers();
});

// Helper functions for tests
export const testHelpers = {
  /**
   * Wait for next tick
   */
  nextTick: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  /**
   * Wait for specified time
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  /**
   * Create a mock function that fails n times then succeeds
   */
  createFlakyFunction: (failureCount: number, successValue: any = 'success') => {
    let attempts = 0;
    return vi.fn(() => {
      attempts++;
      if (attempts <= failureCount) {
        throw new Error(`Attempt ${attempts} failed`);
      }
      return Promise.resolve(successValue);
    });
  },
  
  /**
   * Create a mock function that simulates network errors
   */
  createNetworkErrorFunction: (errorType: 'timeout' | 'fetch' | 'server' = 'fetch') => {
    return vi.fn(() => {
      switch (errorType) {
        case 'timeout':
          throw new Error('Operation timed out after 5000ms');
        case 'server':
          const error = new Error('Internal Server Error');
          (error as any).status = 500;
          throw error;
        case 'fetch':
        default:
          const fetchError = new Error('fetch: network error');
          fetchError.name = 'TypeError';
          throw fetchError;
      }
    });
  },
  
  /**
   * Mock successful operation
   */
  createSuccessFunction: (value: any = 'success') => {
    return vi.fn(() => Promise.resolve(value));
  },
  
  /**
   * Setup fetch mock for health monitoring
   */
  setupHealthyFetch: () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'healthy', timestamp: Date.now() }),
      headers: new Headers({
        'content-type': 'application/json'
      })
    });
  },
  
  /**
   * Setup fetch mock for unhealthy service
   */
  setupUnhealthyFetch: (status: number = 500) => {
    (global.fetch as any).mockRejectedValue(new Error(`HTTP ${status}: Service unavailable`));
  },
  
  /**
   * Get current storage usage
   */
  getStorageUsage: () => ({
    localStorage: global.localStorage.length,
    sessionStorage: global.sessionStorage.length
  })
};

// Make test helpers globally available
declare global {
  const testHelpers: typeof testHelpers;
}

(global as any).testHelpers = testHelpers;