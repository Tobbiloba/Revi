import type { ErrorEvent, SessionEvent, NetworkEvent } from './types';
export declare class IndexedDBStorage {
    private db;
    private dbName;
    private version;
    private storeName;
    private maxQueueSize;
    private maxAge;
    initialize(): Promise<void>;
    store(type: 'error' | 'session' | 'network', data: any): Promise<void>;
    getAll(): Promise<{
        errors: ErrorEvent[];
        sessionEvents: SessionEvent[];
        networkEvents: NetworkEvent[];
    }>;
    clear(): Promise<void>;
    getQueueSize(): Promise<number>;
    private cleanupExpiredItems;
    private removeOldestItems;
    private compress;
    private decompress;
    private generateId;
}
//# sourceMappingURL=indexed-db-storage.d.ts.map