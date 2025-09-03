import type { ErrorEvent, SessionEvent, NetworkEvent, ReviConfig } from './types';
export declare class DataManager {
    private config;
    private storageManager;
    private networkManager;
    private uploadTimer;
    private isUploading;
    private retryAttempts;
    private uploadQueue;
    constructor(config: ReviConfig);
    private initialize;
    private loadQueueFromStorage;
    private saveQueueToStorage;
    private startNetworkAwareUploadTimer;
    private setupNetworkChangeHandler;
    private setupBeforeUnloadHandler;
    queueError(error: ErrorEvent): void;
    queueSessionEvents(events: SessionEvent[]): void;
    queueNetworkEvents(events: NetworkEvent[]): void;
    private hasQueuedData;
    private uploadData;
    private createBatches;
    private uploadDataSync;
    private uploadErrors;
    private uploadSessionEvents;
    private uploadNetworkEvents;
    private uploadErrorsWithRetry;
    private uploadSessionEventsWithRetry;
    private uploadNetworkEventsWithRetry;
    private executeWithRetry;
    clearQueue(): Promise<void>;
    destroy(): void;
}
//# sourceMappingURL=data-manager.d.ts.map