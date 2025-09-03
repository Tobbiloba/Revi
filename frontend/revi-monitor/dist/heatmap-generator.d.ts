import { SessionEvent } from './types';
export interface HeatmapData {
    x: number;
    y: number;
    intensity: number;
    event_type: 'click' | 'move' | 'scroll' | 'hover';
    timestamp: number;
}
export interface HeatmapConfig {
    radius: number;
    maxIntensity: number;
    gradient: Record<string, string>;
    blur: number;
    minOpacity: number;
    maxOpacity: number;
}
export declare class HeatmapGenerator {
    private canvas;
    private ctx;
    private config;
    private data;
    constructor(container: HTMLElement, config?: Partial<HeatmapConfig>);
    private resizeCanvas;
    addDataPoint(x: number, y: number, intensity: number, eventType: HeatmapData['event_type']): void;
    generateFromEvents(events: SessionEvent[]): void;
    render(filter?: HeatmapData['event_type'][]): void;
    private createIntensityMap;
    private createGradient;
    private renderHeatmap;
    clear(): void;
    destroy(): void;
    exportData(): {
        config: HeatmapConfig;
        data: HeatmapData[];
        stats: {
            totalEvents: number;
            eventTypes: Record<string, number>;
            timeRange: {
                start: number;
                end: number;
            };
            bounds: {
                minX: number;
                maxX: number;
                minY: number;
                maxY: number;
            };
        };
    };
    generateInsights(): {
        hotSpots: Array<{
            x: number;
            y: number;
            intensity: number;
            radius: number;
        }>;
        clickPatterns: Array<{
            pattern: string;
            frequency: number;
        }>;
        userBehavior: {
            mostActiveArea: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
            averageClicksPerSession: number;
            scrollDepth: number;
            engagementScore: number;
        };
    };
    private findHotSpots;
    private analyzeClickPatterns;
    private analyzeUserBehavior;
}
//# sourceMappingURL=heatmap-generator.d.ts.map