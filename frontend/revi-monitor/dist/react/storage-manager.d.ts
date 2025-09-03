import type { ErrorEvent, SessionEvent, NetworkEvent } from './types';
export declare class StorageManager {
    private storage;
    private isInitialized;
    initialize(): Promise<void>;
    storeErrors(errors: ErrorEvent[]): Promise<void>;
    storeSessionEvents(events: SessionEvent[]): Promise<void>;
    storeNetworkEvents(events: NetworkEvent[]): Promise<void>;
    getAllData(): Promise<{
        errors: ErrorEvent[];
        sessionEvents: SessionEvent[];
        networkEvents: NetworkEvent[];
    }>;
    clearAll(): Promise<void>;
    getQueueSize(): Promise<number>;
    private ensureInitialized;
}
//# sourceMappingURL=storage-manager.d.ts.map