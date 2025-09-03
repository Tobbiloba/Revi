export declare function compressData(data: any): Promise<{
    data: string;
    compressed: boolean;
}>;
export declare function compressString(str: string): string;
export declare function deduplicateEvents<T extends Record<string, any>>(events: T[]): {
    events: T[];
    compressionRatio: number;
};
export declare function createOptimalBatches<T>(events: T[], maxBatchSize: number, maxBatchBytes?: number): T[][];
//# sourceMappingURL=compression-utils.d.ts.map