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

export class HeatmapGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: HeatmapConfig;
  private data: HeatmapData[] = [];

  constructor(container: HTMLElement, config: Partial<HeatmapConfig> = {}) {
    this.config = {
      radius: 20,
      maxIntensity: 100,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      },
      blur: 15,
      minOpacity: 0,
      maxOpacity: 0.6,
      ...config
    };

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    
    container.appendChild(this.canvas);
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    this.ctx = ctx;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
  }

  addDataPoint(x: number, y: number, intensity: number, eventType: HeatmapData['event_type']): void {
    this.data.push({
      x,
      y,
      intensity,
      event_type: eventType,
      timestamp: Date.now()
    });
    
    // Limit data points to prevent memory issues
    if (this.data.length > 10000) {
      this.data = this.data.slice(-8000);
    }
  }

  generateFromEvents(events: SessionEvent[]): void {
    this.data = [];
    
    events.forEach(event => {
      if (event.event_type === 'click' && event.data?.x && event.data?.y) {
        this.addDataPoint(
          event.data.x,
          event.data.y,
          10,
          'click'
        );
      } else if (event.event_type === 'mousemove' && event.data?.x && event.data?.y) {
        this.addDataPoint(
          event.data.x,
          event.data.y,
          2,
          'move'
        );
      } else if (event.event_type === 'scroll' && event.data?.scrollX !== undefined && event.data?.scrollY !== undefined) {
        // Convert scroll position to viewport coordinates
        this.addDataPoint(
          event.data.scrollX || 0,
          event.data.scrollY || 0,
          5,
          'scroll'
        );
      }
    });
  }

  render(filter?: HeatmapData['event_type'][]): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.data.length === 0) return;

    const filteredData = filter 
      ? this.data.filter(d => filter.includes(d.event_type))
      : this.data;

    // Create intensity map
    const intensityData = this.createIntensityMap(filteredData);
    
    // Create gradient
    const gradient = this.createGradient();
    
    // Render heatmap
    this.renderHeatmap(intensityData, gradient);
  }

  private createIntensityMap(data: HeatmapData[]): ImageData {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = this.canvas.width;
    shadowCanvas.height = this.canvas.height;
    const shadowCtx = shadowCanvas.getContext('2d')!;

    // Draw intensity points
    data.forEach(point => {
      const radius = this.config.radius;
      const gradient = shadowCtx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, radius
      );

      const alpha = Math.min(point.intensity / this.config.maxIntensity, 1);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      shadowCtx.fillStyle = gradient;
      shadowCtx.fillRect(
        point.x - radius,
        point.y - radius,
        radius * 2,
        radius * 2
      );
    });

    // Apply blur
    shadowCtx.filter = `blur(${this.config.blur}px)`;
    shadowCtx.drawImage(shadowCanvas, 0, 0);

    return shadowCtx.getImageData(0, 0, shadowCanvas.width, shadowCanvas.height);
  }

  private createGradient(): ImageData {
    const gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = 256;
    gradientCanvas.height = 1;
    const gradientCtx = gradientCanvas.getContext('2d')!;

    const gradient = gradientCtx.createLinearGradient(0, 0, 256, 0);
    Object.entries(this.config.gradient).forEach(([stop, color]) => {
      gradient.addColorStop(parseFloat(stop), color);
    });

    gradientCtx.fillStyle = gradient;
    gradientCtx.fillRect(0, 0, 256, 1);

    return gradientCtx.getImageData(0, 0, 256, 1);
  }

  private renderHeatmap(intensityData: ImageData, gradientData: ImageData): void {
    const output = this.ctx.createImageData(intensityData.width, intensityData.height);
    
    for (let i = 0; i < intensityData.data.length; i += 4) {
      const alpha = intensityData.data[i + 3];
      
      if (alpha > 0) {
        const gradientIndex = Math.floor((alpha / 255) * 255) * 4;
        
        output.data[i] = gradientData.data[gradientIndex];     // R
        output.data[i + 1] = gradientData.data[gradientIndex + 1]; // G
        output.data[i + 2] = gradientData.data[gradientIndex + 2]; // B
        output.data[i + 3] = Math.floor(alpha * this.config.maxOpacity); // A
      }
    }

    this.ctx.putImageData(output, 0, 0);
  }

  clear(): void {
    this.data = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    this.clear();
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    window.removeEventListener('resize', () => this.resizeCanvas());
  }

  // Export heatmap data for analysis
  exportData(): {
    config: HeatmapConfig;
    data: HeatmapData[];
    stats: {
      totalEvents: number;
      eventTypes: Record<string, number>;
      timeRange: { start: number; end: number };
      bounds: { minX: number; maxX: number; minY: number; maxY: number };
    };
  } {
    const eventTypes: Record<string, number> = {};
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let minTime = Infinity, maxTime = -Infinity;

    this.data.forEach(point => {
      eventTypes[point.event_type] = (eventTypes[point.event_type] || 0) + 1;
      
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      
      minTime = Math.min(minTime, point.timestamp);
      maxTime = Math.max(maxTime, point.timestamp);
    });

    return {
      config: this.config,
      data: [...this.data],
      stats: {
        totalEvents: this.data.length,
        eventTypes,
        timeRange: { start: minTime, end: maxTime },
        bounds: { minX, maxX, minY, maxY }
      }
    };
  }

  // Generate insights from heatmap data
  generateInsights(): {
    hotSpots: Array<{ x: number; y: number; intensity: number; radius: number }>;
    clickPatterns: Array<{ pattern: string; frequency: number }>;
    userBehavior: {
      mostActiveArea: { x: number; y: number; width: number; height: number };
      averageClicksPerSession: number;
      scrollDepth: number;
      engagementScore: number;
    };
  } {
    // Find hot spots using clustering
    const hotSpots = this.findHotSpots();
    
    // Analyze click patterns
    const clickPatterns = this.analyzeClickPatterns();
    
    // Generate user behavior insights
    const userBehavior = this.analyzeUserBehavior();

    return {
      hotSpots,
      clickPatterns,
      userBehavior
    };
  }

  private findHotSpots(): Array<{ x: number; y: number; intensity: number; radius: number }> {
    const clusters: Array<{ x: number; y: number; intensity: number; count: number }> = [];
    const clusterRadius = this.config.radius * 2;

    this.data.forEach(point => {
      let foundCluster = false;
      
      for (const cluster of clusters) {
        const distance = Math.sqrt(
          Math.pow(point.x - cluster.x, 2) + Math.pow(point.y - cluster.y, 2)
        );
        
        if (distance <= clusterRadius) {
          // Add to existing cluster
          cluster.x = (cluster.x * cluster.count + point.x) / (cluster.count + 1);
          cluster.y = (cluster.y * cluster.count + point.y) / (cluster.count + 1);
          cluster.intensity += point.intensity;
          cluster.count++;
          foundCluster = true;
          break;
        }
      }
      
      if (!foundCluster) {
        clusters.push({
          x: point.x,
          y: point.y,
          intensity: point.intensity,
          count: 1
        });
      }
    });

    return clusters
      .filter(cluster => cluster.count >= 3) // Only significant clusters
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 10) // Top 10 hot spots
      .map(cluster => ({
        x: Math.round(cluster.x),
        y: Math.round(cluster.y),
        intensity: Math.round(cluster.intensity),
        radius: Math.min(clusterRadius, cluster.count * 5)
      }));
  }

  private analyzeClickPatterns(): Array<{ pattern: string; frequency: number }> {
    const clicks = this.data.filter(d => d.event_type === 'click');
    const patterns: Record<string, number> = {};

    // Analyze sequential click patterns
    for (let i = 0; i < clicks.length - 1; i++) {
      const current = clicks[i];
      const next = clicks[i + 1];
      
      const timeDiff = next.timestamp - current.timestamp;
      if (timeDiff < 5000) { // Within 5 seconds
        const pattern = `(${Math.round(current.x)},${Math.round(current.y)}) -> (${Math.round(next.x)},${Math.round(next.y)})`;
        patterns[pattern] = (patterns[pattern] || 0) + 1;
      }
    }

    return Object.entries(patterns)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([pattern, frequency]) => ({ pattern, frequency }));
  }

  private analyzeUserBehavior(): {
    mostActiveArea: { x: number; y: number; width: number; height: number };
    averageClicksPerSession: number;
    scrollDepth: number;
    engagementScore: number;
  } {
    const clicks = this.data.filter(d => d.event_type === 'click');
    const scrolls = this.data.filter(d => d.event_type === 'scroll');

    // Find most active area (bounding box of top 50% of events)
    const sortedByIntensity = [...this.data].sort((a, b) => b.intensity - a.intensity);
    const topHalf = sortedByIntensity.slice(0, Math.floor(sortedByIntensity.length * 0.5));
    
    const minX = Math.min(...topHalf.map(d => d.x));
    const maxX = Math.max(...topHalf.map(d => d.x));
    const minY = Math.min(...topHalf.map(d => d.y));
    const maxY = Math.max(...topHalf.map(d => d.y));

    const scrollDepth = scrolls.length > 0 
      ? Math.max(...scrolls.map(s => s.y)) / this.canvas.height 
      : 0;

    const engagementScore = Math.min(100, 
      (clicks.length * 2) + 
      (scrollDepth * 50) + 
      (this.data.filter(d => d.event_type === 'move').length * 0.1)
    );

    return {
      mostActiveArea: {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(maxX - minX),
        height: Math.round(maxY - minY)
      },
      averageClicksPerSession: Math.round(clicks.length),
      scrollDepth: Math.round(scrollDepth * 100) / 100,
      engagementScore: Math.round(engagementScore)
    };
  }
}