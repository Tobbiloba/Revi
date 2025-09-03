import { api, Query } from "encore.dev/api";
import { db } from "./db";

export interface TrendDataPoint {
  timestamp: Date;
  error_count: number;
  unique_users: number;
  unique_sessions: number;
  avg_response_time?: number;
}

export interface ErrorTrendsParams {
  project_id: number;
  error_group_id?: Query<number>;
  time_range?: Query<'1h' | '24h' | '7d' | '30d'>;
  granularity?: Query<'hour' | 'day'>;
}

export interface ErrorTrendsResponse {
  trends: TrendDataPoint[];
  total_errors: number;
  total_users: number;
  peak_error_rate: number;
  trend_direction: 'up' | 'down' | 'stable';
  anomalies_detected: boolean;
  spike_alerts: Array<{
    timestamp: Date;
    severity: 'warning' | 'critical';
    description: string;
  }>;
}

/**
 * Get error trends and statistical analysis
 */
export const getErrorTrends = api<ErrorTrendsParams, ErrorTrendsResponse>(
  { expose: true, method: "GET", path: "/api/intelligence/trends/:project_id" },
  async (params) => {
    const timeRange = params.time_range || '24h';
    const granularity = params.granularity || 'hour';
    
    // Calculate time range
    const endTime = new Date();
    const startTime = new Date();
    
    switch (timeRange) {
      case '1h':
        startTime.setHours(endTime.getHours() - 1);
        break;
      case '24h':
        startTime.setHours(endTime.getHours() - 24);
        break;
      case '7d':
        startTime.setDate(endTime.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(endTime.getDate() - 30);
        break;
    }
    
    // Build query parameters
    const queryParams: any[] = [params.project_id, startTime, endTime];
    if (params.error_group_id) {
      queryParams.push(params.error_group_id);
    }
    
    // Determine time bucket based on granularity
    const timeBucketExpr = granularity === 'day' 
      ? "date_trunc('day', timestamp)" 
      : "date_trunc('hour', timestamp)";
    
    // Query trend data from actual errors table
    const trendsQuery = `
      SELECT 
        ${timeBucketExpr} as timestamp,
        COUNT(*)::numeric as error_count,
        COUNT(DISTINCT session_id)::numeric as unique_users,
        COUNT(DISTINCT session_id)::numeric as unique_sessions,
        0::numeric as avg_response_time
      FROM errors
      WHERE project_id = $1 AND timestamp >= $2 AND timestamp <= $3
      ${params.error_group_id ? `AND error_group_id = $4` : ''}
      GROUP BY ${timeBucketExpr}
      ORDER BY timestamp ASC
    `;
    
    const trends = await db.rawQueryAll<TrendDataPoint>(trendsQuery, ...queryParams);
    
    // Calculate summary statistics
    const totalErrors = trends.reduce((sum, point) => sum + point.error_count, 0);
    const totalUsers = Math.max(...trends.map(point => point.unique_users));
    const peakErrorRate = Math.max(...trends.map(point => point.error_count));
    
    // Analyze trend direction
    const trendDirection = analyzeTrendDirection(trends);
    
    // Detect anomalies and spikes
    const anomaliesDetected = detectAnomalies(trends);
    const spikeAlerts = detectSpikes(trends);
    
    return {
      trends,
      total_errors: totalErrors,
      total_users: totalUsers,
      peak_error_rate: peakErrorRate,
      trend_direction: trendDirection,
      anomalies_detected: anomaliesDetected,
      spike_alerts: spikeAlerts
    };
  }
);

/**
 * Get error statistics for specific groups
 */
export interface ErrorGroupStatsParams {
  project_id: number;
  group_ids?: number[];
  time_range?: '1h' | '24h' | '7d' | '30d';
}

export interface ErrorGroupStats {
  group_id: number;
  title: string;
  total_occurrences: number;
  unique_users: number;
  error_rate_change: number; // Percentage change
  last_seen: Date;
  trend: 'up' | 'down' | 'stable';
  impact_score: number; // 0-100 based on occurrences and users
}

export const getErrorGroupStats = api<ErrorGroupStatsParams, { stats: ErrorGroupStats[] }>(
  { expose: true, method: "GET", path: "/api/intelligence/group-stats/:project_id" },
  async (params) => {
    const timeRange = params.time_range || '24h';
    
    // Calculate time boundaries
    const endTime = new Date();
    const startTime = new Date();
    const compareStartTime = new Date();
    
    switch (timeRange) {
      case '1h':
        startTime.setHours(endTime.getHours() - 1);
        compareStartTime.setHours(endTime.getHours() - 2);
        break;
      case '24h':
        startTime.setHours(endTime.getHours() - 24);
        compareStartTime.setHours(endTime.getHours() - 48);
        break;
      case '7d':
        startTime.setDate(endTime.getDate() - 7);
        compareStartTime.setDate(endTime.getDate() - 14);
        break;
      case '30d':
        startTime.setDate(endTime.getDate() - 30);
        compareStartTime.setDate(endTime.getDate() - 60);
        break;
    }
    
    let groupFilter = "";
    const queryParams: any[] = [params.project_id, startTime, endTime, compareStartTime];
    
    if (params.group_ids && params.group_ids.length > 0) {
      groupFilter = ` AND eg.id = ANY($5)`;
      queryParams.push(params.group_ids);
    }
    
    const query = `
      WITH current_stats AS (
        SELECT 
          eg.id as group_id,
          eg.title,
          eg.last_seen,
          COALESCE(SUM(es.error_count), 0) as current_errors,
          COALESCE(SUM(es.unique_users), 0) as current_users
        FROM error_groups eg
        LEFT JOIN error_statistics es ON eg.id = es.error_group_id 
          AND es.time_bucket >= $2 AND es.time_bucket <= $3
        WHERE eg.project_id = $1 ${groupFilter}
        GROUP BY eg.id, eg.title, eg.last_seen
      ),
      previous_stats AS (
        SELECT 
          eg.id as group_id,
          COALESCE(SUM(es.error_count), 0) as previous_errors
        FROM error_groups eg
        LEFT JOIN error_statistics es ON eg.id = es.error_group_id 
          AND es.time_bucket >= $4 AND es.time_bucket < $2
        WHERE eg.project_id = $1 ${groupFilter}
        GROUP BY eg.id
      )
      SELECT 
        cs.group_id,
        cs.title,
        cs.current_errors as total_occurrences,
        cs.current_users as unique_users,
        cs.last_seen,
        CASE 
          WHEN ps.previous_errors = 0 AND cs.current_errors > 0 THEN 100
          WHEN ps.previous_errors = 0 THEN 0
          ELSE ((cs.current_errors - ps.previous_errors) * 100.0 / ps.previous_errors)
        END as error_rate_change
      FROM current_stats cs
      LEFT JOIN previous_stats ps ON cs.group_id = ps.group_id
      ORDER BY cs.current_errors DESC
    `;
    
    const results = await db.rawQueryAll<{
      group_id: number;
      title: string;
      total_occurrences: number;
      unique_users: number;
      last_seen: Date;
      error_rate_change: number;
    }>(query, ...queryParams);
    
    const stats: ErrorGroupStats[] = results.map(row => ({
      group_id: row.group_id,
      title: row.title,
      total_occurrences: row.total_occurrences,
      unique_users: row.unique_users,
      error_rate_change: Math.round(row.error_rate_change * 100) / 100,
      last_seen: row.last_seen,
      trend: row.error_rate_change > 10 ? 'up' : row.error_rate_change < -10 ? 'down' : 'stable',
      impact_score: calculateImpactScore(row.total_occurrences, row.unique_users)
    }));
    
    return { stats };
  }
);

/**
 * Analyze trend direction using linear regression
 */
function analyzeTrendDirection(trends: TrendDataPoint[]): 'up' | 'down' | 'stable' {
  if (trends.length < 3) return 'stable';
  
  // Simple linear regression to determine trend
  const n = trends.length;
  const x = trends.map((_, i) => i);
  const y = trends.map(point => point.error_count);
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  // Consider trends with slopes > 5% of average as significant
  const avgY = sumY / n;
  const threshold = avgY * 0.05;
  
  if (slope > threshold) return 'up';
  if (slope < -threshold) return 'down';
  return 'stable';
}

/**
 * Detect statistical anomalies in error trends
 */
function detectAnomalies(trends: TrendDataPoint[]): boolean {
  if (trends.length < 10) return false;
  
  // Calculate moving average and standard deviation
  const windowSize = Math.min(5, Math.floor(trends.length / 2));
  let anomaliesFound = false;
  
  for (let i = windowSize; i < trends.length; i++) {
    const window = trends.slice(i - windowSize, i);
    const avg = window.reduce((sum, point) => sum + point.error_count, 0) / windowSize;
    const variance = window.reduce((sum, point) => sum + Math.pow(point.error_count - avg, 2), 0) / windowSize;
    const stdDev = Math.sqrt(variance);
    
    // Check if current point is more than 2 standard deviations from average
    const current = trends[i].error_count;
    if (Math.abs(current - avg) > 2 * stdDev && stdDev > 0) {
      anomaliesFound = true;
      break;
    }
  }
  
  return anomaliesFound;
}

/**
 * Detect error spikes that warrant alerts
 */
function detectSpikes(trends: TrendDataPoint[]): Array<{
  timestamp: Date;
  severity: 'warning' | 'critical';
  description: string;
}> {
  const spikes: Array<{
    timestamp: Date;
    severity: 'warning' | 'critical';
    description: string;
  }> = [];
  
  if (trends.length < 3) return spikes;
  
  // Calculate baseline (average of first half)
  const baselineSize = Math.floor(trends.length / 2);
  const baseline = trends.slice(0, baselineSize);
  const avgBaseline = baseline.reduce((sum, point) => sum + point.error_count, 0) / baselineSize;
  
  // Check for spikes in the second half
  const recentTrends = trends.slice(baselineSize);
  
  for (const point of recentTrends) {
    const multiplier = avgBaseline > 0 ? point.error_count / avgBaseline : 0;
    
    if (multiplier >= 5) {
      spikes.push({
        timestamp: point.timestamp,
        severity: 'critical',
        description: `Error rate increased ${Math.round(multiplier * 100)}% above baseline`
      });
    } else if (multiplier >= 2) {
      spikes.push({
        timestamp: point.timestamp,
        severity: 'warning',
        description: `Error rate increased ${Math.round(multiplier * 100)}% above baseline`
      });
    }
  }
  
  return spikes;
}

/**
 * Calculate impact score based on occurrences and user count
 */
function calculateImpactScore(occurrences: number, users: number): number {
  // Weight: 70% occurrences, 30% unique users
  const maxOccurrences = 1000; // Normalize to this value
  const maxUsers = 100; // Normalize to this value
  
  const occurrenceScore = Math.min(occurrences / maxOccurrences, 1) * 70;
  const userScore = Math.min(users / maxUsers, 1) * 30;
  
  return Math.round(occurrenceScore + userScore);
}