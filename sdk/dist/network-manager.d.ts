export declare class NetworkManager {
    private isOnline;
    private connectionType;
    private listeners;
    constructor();
    getConnectionStatus(): {
        online: boolean;
        connectionType: string;
    };
    onConnectionChange(callback: (online: boolean) => void): () => void;
    getBatchSize(): number;
    getUploadDelay(): number;
    shouldRetry(attempt: number): boolean;
    getRetryDelay(attempt: number): number;
    private detectConnectionType;
    private notifyListeners;
    testConnectivity(url?: string): Promise<boolean>;
}
//# sourceMappingURL=network-manager.d.ts.map