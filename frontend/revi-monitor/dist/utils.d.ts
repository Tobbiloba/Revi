export declare function generateId(): string;
export declare function formatStackTrace(error: Error): string;
export declare function sanitizeUrl(url: string, allowUrls?: string[], denyUrls?: string[]): string;
export declare function maskSensitiveData(data: any, maskInputs?: boolean): any;
export declare function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void;
export declare function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void;
export declare function isBot(): boolean;
export declare function getSessionStorage(): Storage | null;
export declare function getLocalStorage(): Storage | null;
//# sourceMappingURL=utils.d.ts.map