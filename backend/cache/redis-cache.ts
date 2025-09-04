import { APIError } from "encore.dev/api";

/**
 * Redis-based caching system for high-performance data access
 * Implements smart caching with TTL and pattern-based invalidation
 */

// Mock Redis implementation for development - replace with actual Redis in production
class RedisClient {
  private cache = new Map<string, { data: string; expiry: number }>();
  
  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.cache.set(key, {
      data: value,
      expiry: Date.now() + (ttlSeconds * 1000)
    });
  }
  
  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }
}

class StatsCacheManager {
  private redis: RedisClient;
  
  constructor() {
    // In production, use: new Redis(process.env.REDIS_URL)
    this.redis = new RedisClient();
  }
  
  /**
   * Generic cache get method
   */
  async get(key: string): Promise<any | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Redis cache error (get):', error);
      return null;
    }
  }

  /**
   * Generic cache set method
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis cache error (set):', error);
    }
  }
  
  /**
   * Get cached project statistics
   */
  async getProjectStats(projectId: number, days: number): Promise<any | null> {
    try {
      const cacheKey = this.getStatsKey(projectId, days);
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        console.log(`[Cache HIT] Project stats for ${projectId} (${days} days)`);
        return JSON.parse(cached);
      }
      
      console.log(`[Cache MISS] Project stats for ${projectId} (${days} days)`);
      return null;
    } catch (error) {
      console.error('Redis cache error (get):', error);
      return null; // Fail gracefully
    }
  }
  
  /**
   * Cache project statistics with smart TTL
   */
  async setProjectStats(projectId: number, days: number, stats: any): Promise<void> {
    try {
      const cacheKey = this.getStatsKey(projectId, days);
      
      // Smart TTL based on data recency
      const ttl = this.calculateTTL(days);
      
      await this.redis.setex(cacheKey, ttl, JSON.stringify(stats));
      console.log(`[Cache SET] Project stats for ${projectId} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('Redis cache error (set):', error);
      // Continue without caching to avoid breaking functionality
    }
  }
  
  /**
   * Invalidate project-specific caches when new data arrives
   */
  async invalidateProjectCaches(projectId: number): Promise<void> {
    try {
      const patterns = [
        `project_stats:${projectId}:*`,
        `error_groups:${projectId}:*`,
        `browser_stats:${projectId}:*`,
        `session_analytics:${projectId}:*`
      ];
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        for (const key of keys) {
          await this.redis.del(key);
        }
      }
      
      console.log(`[Cache INVALIDATE] Cleared ${patterns.length} patterns for project ${projectId}`);
    } catch (error) {
      console.error('Redis cache error (invalidate):', error);
    }
  }
  
  /**
   * Cache browser/OS distribution data
   */
  async getBrowserStats(projectId: number, days: number): Promise<any | null> {
    try {
      const cacheKey = `browser_stats:${projectId}:${days}d`;
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis cache error (browser stats):', error);
      return null;
    }
  }
  
  async setBrowserStats(projectId: number, days: number, stats: any): Promise<void> {
    try {
      const cacheKey = `browser_stats:${projectId}:${days}d`;
      const ttl = this.calculateTTL(days);
      await this.redis.setex(cacheKey, ttl, JSON.stringify(stats));
    } catch (error) {
      console.error('Redis cache error (set browser stats):', error);
    }
  }
  
  /**
   * Cache error grouping results
   */
  async getErrorGroups(projectId: number, timeframe: string): Promise<any | null> {
    try {
      const cacheKey = `error_groups:${projectId}:${timeframe}`;
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis cache error (error groups):', error);
      return null;
    }
  }
  
  async setErrorGroups(projectId: number, timeframe: string, groups: any): Promise<void> {
    try {
      const cacheKey = `error_groups:${projectId}:${timeframe}`;
      // Error groups cache for 10 minutes
      await this.redis.setex(cacheKey, 600, JSON.stringify(groups));
    } catch (error) {
      console.error('Redis cache error (set error groups):', error);
    }
  }
  
  /**
   * Generate cache key for project stats
   */
  private getStatsKey(projectId: number, days: number): string {
    // Round to nearest hour for better cache hit rate
    const hourlyTimestamp = Math.floor(Date.now() / (1000 * 60 * 60));
    return `project_stats:${projectId}:${days}d:${hourlyTimestamp}`;
  }
  
  /**
   * Calculate smart TTL based on data age and volatility
   */
  private calculateTTL(days: number): number {
    if (days <= 1) return 300;    // 5 minutes for recent data
    if (days <= 7) return 900;    // 15 minutes for weekly data
    if (days <= 30) return 1800;  // 30 minutes for monthly data
    return 3600;                  // 1 hour for historical data
  }
  
  /**
   * Health check for cache system
   */
  async healthCheck(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await this.redis.setex('health_check', 60, 'ok');
      const result = await this.redis.get('health_check');
      const latency = Date.now() - start;
      
      return result === 'ok' 
        ? { status: 'healthy', latency }
        : { status: 'unhealthy' };
    } catch (error) {
      return { status: 'error' };
    }
  }
}

// Export singleton instance
export const cacheManager = new StatsCacheManager();

// Export types for use in other modules
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}