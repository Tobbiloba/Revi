import type { ErrorEvent, SessionEvent, NetworkEvent, ReviConfig } from './types';
export declare class DataManager {
    private config;
    private storage;
    private uploadQueue;
    private uploadTimer;
    private isUploading;
    constructor(config: ReviConfig);
    private loadQueueFromStorage;
    private saveQueueToStorage;
    private startUploadTimer;
    private setupBeforeUnloadHandler;
    queueError(error: ErrorEvent): void;
    queueSessionEvents(events: SessionEvent[]): void;
    queueNetworkEvents(events: NetworkEvent[]): void;
    private hasQueuedData;
    private uploadData;
    private uploadDataSync;
    private uploadErrors;
    private uploadSessionEvents;
    private uploadNetworkEvents;
    clearQueue(): void;
    destroy(): void;
}
//# sourceMappingURL=data-manager.d.ts.map