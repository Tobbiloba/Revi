/**
 * Test setup for Vitest
 * Configures global test environment and mocks
 */
export declare const testHelpers: {
    /**
     * Wait for next tick
     */
    nextTick: () => Promise<unknown>;
    /**
     * Wait for specified time
     */
    wait: (ms: number) => Promise<unknown>;
    /**
     * Create a mock function that fails n times then succeeds
     */
    createFlakyFunction: (failureCount: number, successValue?: any) => import("vitest").Mock<[], Promise<any>>;
    /**
     * Create a mock function that simulates network errors
     */
    createNetworkErrorFunction: (errorType?: "timeout" | "fetch" | "server") => import("vitest").Mock<[], never>;
    /**
     * Mock successful operation
     */
    createSuccessFunction: (value?: any) => import("vitest").Mock<[], Promise<any>>;
    /**
     * Setup fetch mock for health monitoring
     */
    setupHealthyFetch: () => void;
    /**
     * Setup fetch mock for unhealthy service
     */
    setupUnhealthyFetch: (status?: number) => void;
    /**
     * Get current storage usage
     */
    getStorageUsage: () => {
        localStorage: number;
        sessionStorage: number;
    };
};
declare global {
    const testHelpers: typeof testHelpers;
}
//# sourceMappingURL=setup.d.ts.map