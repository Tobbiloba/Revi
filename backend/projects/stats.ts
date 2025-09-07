import { api, Query } from "encore.dev/api";
import { db } from "./db";
import { cacheManager } from "../cache/redis-cache";

export interface ProjectStatsParams {
  projectId: number;
  days?: Query<number>;
}

export interface ProjectStats {
  totalErrors: number;
  errorRate: number;
  activeSessions: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastSeen: Date;
  }>;
  errorTrend: Array<{
    date: string;
    count: number;
  }>;
  browserDistribution: Array<{
    browser: string;
    version?: string;
    count: number;
    percentage: number;
  }>;
  osDistribution: Array<{
    os: string;
    version?: string;
    count: number;
    percentage: number;
  }>;
  deviceTypeDistribution: Array<{
    deviceType: string;
    count: number;
    percentage: number;
  }>;
  screenResolutionDistribution: Array<{
    resolution: string;
    count: number;
    percentage: number;
  }>;
  topErrorPages: Array<{
    url: string;
    count: number;
    percentage: number;
  }>;
  errorsByStatus: {
    new: number;
    investigating: number;
    resolved: number;
    ignored: number;
  };
  averageSessionDuration: number;
  uniqueUsers: number;
}

// Gets comprehensive statistics and metrics for a project over a specified time period.
export const getProjectStats = api<ProjectStatsParams, ProjectStats>(
  { expose: true, method: "GET", path: "/api/projects/:projectId/stats" },
  async (params) => {
    const days = params.days || 7;
    
    // OPTIMIZATION: Check cache first for significant performance improvement
    const cachedStats = await cacheManager.getProjectStats(params.projectId, days);
    if (cachedStats) {
      return cachedStats;
    }
    
    // Calculate stats if not cached
    const stats = await calculateProjectStats(params.projectId, days);
    
    // Cache the results for future requests
    await cacheManager.setProjectStats(params.projectId, days, stats);
    
    return stats;
  }
);

/**
 * Calculate comprehensive project statistics with optimized queries
 */
async function calculateProjectStats(projectId: number, days: number): Promise<ProjectStats> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    // Get total error count for the period
    const totalErrorsResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM errors
      WHERE project_id = ${projectId}
      AND timestamp >= ${startDate}
      AND timestamp <= ${endDate}
    `;
    
    const totalErrors = totalErrorsResult?.count || 0;
    
    // Calculate error rate (errors per day)
    const errorRate = Math.round((totalErrors / days) * 100) / 100;
    
    // Get unique active sessions count
    const activeSessionsResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(DISTINCT session_id) as count
      FROM sessions
      WHERE project_id = ${projectId}
      AND started_at >= ${startDate}
      AND started_at <= ${endDate}
    `;
    
    const activeSessions = activeSessionsResult?.count || 0;
    
    // Get unique users count (based on session metadata or IP addresses)
    const uniqueUsersResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(DISTINCT 
        COALESCE(
          (metadata->>'user_id')::text,
          (metadata->>'userId')::text,
          session_id::text
        )
      ) as count
      FROM sessions
      WHERE project_id = ${projectId}
      AND started_at >= ${startDate}
      AND started_at <= ${endDate}
    `;
    
    const uniqueUsers = uniqueUsersResult?.count || 0;
    
    // Calculate average session duration
    const sessionDurationsResult = await db.queryAll<{ duration: number }>`
      SELECT 
        EXTRACT(EPOCH FROM (
          COALESCE(ended_at, NOW()) - started_at
        ))::DOUBLE PRECISION as duration
      FROM sessions
      WHERE project_id = ${projectId}
      AND started_at >= ${startDate}
      AND started_at <= ${endDate}
      AND started_at IS NOT NULL
    `;
    
    let averageSessionDuration = 0;
    if (sessionDurationsResult.length > 0) {
      const totalDuration = sessionDurationsResult.reduce((sum, session) => sum + (session.duration || 0), 0);
      averageSessionDuration = Math.round(totalDuration / sessionDurationsResult.length);
    }
    
    // Get top errors by frequency
    const topErrorsResult = await db.queryAll<{
      message: string;
      count: number;
      last_seen: Date;
    }>`
      SELECT 
        message,
        COUNT(*) as count,
        MAX(timestamp) as last_seen
      FROM errors
      WHERE project_id = ${projectId}
      AND timestamp >= ${startDate}
      AND timestamp <= ${endDate}
      GROUP BY message
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const topErrors = topErrorsResult.map(row => ({
      message: row.message,
      count: row.count,
      lastSeen: row.last_seen
    }));
    
    // Get errors by status (handle missing status field gracefully)
    const errorsByStatusResult = await db.queryAll<{ status: string | null; count: number }>`
      SELECT 
        COALESCE(
          (metadata->>'status')::text,
          (metadata->>'error_status')::text,
          'new'
        ) as status,
        COUNT(*) as count
      FROM errors
      WHERE project_id = ${projectId}
      AND timestamp >= ${startDate}
      AND timestamp <= ${endDate}
      GROUP BY COALESCE(
        (metadata->>'status')::text,
        (metadata->>'error_status')::text,
        'new'
      )
    `;
    
    const errorsByStatus = {
      new: 0,
      investigating: 0,
      resolved: 0,
      ignored: 0
    };
    
    errorsByStatusResult.forEach(row => {
      const status = row.status || 'new';
      switch (status) {
        case 'investigating':
        case 'in_progress':
        case 'assigned':
          errorsByStatus.investigating += row.count;
          break;
        case 'resolved':
        case 'fixed':
        case 'closed':
          errorsByStatus.resolved += row.count;
          break;
        case 'ignored':
        case 'muted':
        case 'dismissed':
          errorsByStatus.ignored += row.count;
          break;
        default:
          errorsByStatus.new += row.count;
      }
    });
    
    // Get top error pages
    const topErrorPagesResult = await db.queryAll<{ url: string; count: number }>`
      SELECT 
        COALESCE(url, 'Unknown') as url,
        COUNT(*) as count
      FROM errors
      WHERE project_id = ${projectId}
      AND timestamp >= ${startDate}
      AND timestamp <= ${endDate}
      AND url IS NOT NULL
      AND url != ''
      GROUP BY url
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const topErrorPages = topErrorPagesResult.map(row => ({
      url: row.url,
      count: row.count,
      percentage: totalErrors > 0 ? Math.round((row.count / totalErrors) * 100 * 100) / 100 : 0
    }));
    
    // Get device analytics data (browser, OS, device type, screen resolution)
    const deviceAnalyticsResult = await db.queryAll<{
      browser_name: string;
      browser_version: string;
      os_name: string;
      os_version: string;
      device_type: string;
      screen_resolution: string;
      total_sessions: number;
      total_errors: number;
    }>`
      SELECT 
        browser_name,
        browser_version,
        os_name,
        os_version,
        device_type,
        screen_resolution,
        total_sessions,
        total_errors
      FROM device_analytics
      WHERE project_id = ${projectId}
      AND last_seen >= ${startDate}
      AND last_seen <= ${endDate}
      AND browser_name IS NOT NULL
      AND browser_name != ''
      ORDER BY total_sessions DESC
    `;
    
    // Aggregate browser distribution
    const browserMap = new Map<string, { count: number; totalSessions: number }>();
    const osMap = new Map<string, { count: number; totalSessions: number }>();
    const deviceTypeMap = new Map<string, { count: number; totalSessions: number }>();
    const screenResolutionMap = new Map<string, { count: number; totalSessions: number }>();
    
    deviceAnalyticsResult.forEach(row => {
      // Group browser versions (e.g., Chrome 120.0.0 -> Chrome 120)
      const browserVersion = row.browser_version ? row.browser_version.split('.')[0] : '';
      const browserKey = browserVersion ? `${row.browser_name} ${browserVersion}` : row.browser_name;
      
      // Group OS versions (e.g., macOS 14.2.1 -> macOS 14)
      const osVersion = row.os_version ? row.os_version.split('.')[0] : '';
      const osKey = osVersion ? `${row.os_name} ${osVersion}` : row.os_name;
      
      // Device type and screen resolution
      const deviceTypeKey = row.device_type || 'unknown';
      const screenResKey = row.screen_resolution || 'unknown';
      
      // Update maps with session counts (more accurate than error counts)
      const sessions = row.total_sessions || 1;
      
      const currentBrowser = browserMap.get(browserKey) || { count: 0, totalSessions: 0 };
      browserMap.set(browserKey, { 
        count: currentBrowser.count + 1, 
        totalSessions: currentBrowser.totalSessions + sessions 
      });
      
      const currentOS = osMap.get(osKey) || { count: 0, totalSessions: 0 };
      osMap.set(osKey, { 
        count: currentOS.count + 1, 
        totalSessions: currentOS.totalSessions + sessions 
      });
      
      const currentDeviceType = deviceTypeMap.get(deviceTypeKey) || { count: 0, totalSessions: 0 };
      deviceTypeMap.set(deviceTypeKey, { 
        count: currentDeviceType.count + 1, 
        totalSessions: currentDeviceType.totalSessions + sessions 
      });
      
      const currentScreenRes = screenResolutionMap.get(screenResKey) || { count: 0, totalSessions: 0 };
      screenResolutionMap.set(screenResKey, { 
        count: currentScreenRes.count + 1, 
        totalSessions: currentScreenRes.totalSessions + sessions 
      });
    });
    
    // Calculate totals for percentage calculations
    const totalBrowserSessions = Array.from(browserMap.values()).reduce((sum, item) => sum + item.totalSessions, 0);
    const totalOSSessions = Array.from(osMap.values()).reduce((sum, item) => sum + item.totalSessions, 0);
    const totalDeviceTypeSessions = Array.from(deviceTypeMap.values()).reduce((sum, item) => sum + item.totalSessions, 0);
    const totalScreenResSessions = Array.from(screenResolutionMap.values()).reduce((sum, item) => sum + item.totalSessions, 0);
    
    // Build distribution arrays
    const browserDistribution = Array.from(browserMap.entries())
      .sort(([, a], [, b]) => b.totalSessions - a.totalSessions)
      .slice(0, 10)
      .map(([browser, data]) => ({
        browser: browser.split(' ')[0], // Browser name
        version: browser.includes(' ') ? browser.split(' ')[1] : undefined,
        count: data.totalSessions,
        percentage: totalBrowserSessions > 0 ? Math.round((data.totalSessions / totalBrowserSessions) * 100 * 100) / 100 : 0
      }));
    
    const osDistribution = Array.from(osMap.entries())
      .sort(([, a], [, b]) => b.totalSessions - a.totalSessions)
      .slice(0, 10)
      .map(([os, data]) => ({
        os: os.split(' ')[0], // OS name
        version: os.includes(' ') ? os.split(' ')[1] : undefined,
        count: data.totalSessions,
        percentage: totalOSSessions > 0 ? Math.round((data.totalSessions / totalOSSessions) * 100 * 100) / 100 : 0
      }));
    
    const deviceTypeDistribution = Array.from(deviceTypeMap.entries())
      .sort(([, a], [, b]) => b.totalSessions - a.totalSessions)
      .map(([deviceType, data]) => ({
        deviceType: deviceType.charAt(0).toUpperCase() + deviceType.slice(1), // Capitalize
        count: data.totalSessions,
        percentage: totalDeviceTypeSessions > 0 ? Math.round((data.totalSessions / totalDeviceTypeSessions) * 100 * 100) / 100 : 0
      }));
    
    const screenResolutionDistribution = Array.from(screenResolutionMap.entries())
      .sort(([, a], [, b]) => b.totalSessions - a.totalSessions)
      .slice(0, 8) // Top 8 resolutions
      .map(([resolution, data]) => ({
        resolution,
        count: data.totalSessions,
        percentage: totalScreenResSessions > 0 ? Math.round((data.totalSessions / totalScreenResSessions) * 100 * 100) / 100 : 0
      }));
    
    // Create error trend data (errors per day)
    const trendData: Array<{ date: string; count: number }> = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(endDate.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayErrorsResult = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM errors
        WHERE project_id = ${projectId}
        AND timestamp >= ${dayStart}
        AND timestamp <= ${dayEnd}
      `;
      
      trendData.unshift({
        date: dateStr,
        count: dayErrorsResult?.count || 0
      });
    }
    
    return {
      totalErrors,
      errorRate,
      activeSessions,
      uniqueUsers,
      averageSessionDuration,
      topErrors,
      errorTrend: trendData,
      browserDistribution,
      osDistribution,
      deviceTypeDistribution,
      screenResolutionDistribution,
      topErrorPages,
      errorsByStatus
    };
}

export interface DatabaseStatsParams {
  project_id?: Query<number>;
}

export interface DatabaseStatsResponse {
  success: true;
  stats: {
    projects: number;
    errors: number;
    sessions: number;
    sessionEvents: number;
    networkEvents: number;
    lastUpdated: Date;
  };
  project_specific?: {
    project_id: number;
    errors: number;
    sessions: number;
    sessionEvents: number;
    networkEvents: number;
  };
}

// Get real database statistics for monitoring and debugging
export const getDatabaseStats = api<DatabaseStatsParams, DatabaseStatsResponse>(
  { expose: true, method: "GET", path: "/api/database/stats" },
  async (params) => {
    // Get overall statistics
    const totalProjects = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM projects
    `;
    
    const totalErrors = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM errors
    `;
    
    const totalSessions = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM sessions
    `;
    
    const totalSessionEvents = await db.queryRow<{ count: number }>`
      SELECT (
        (SELECT COUNT(*) FROM session_events) + 
        (SELECT COUNT(*) FROM user_journey_events)
      ) as count
    `;
    
    const totalNetworkEvents = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM network_events
    `;

    const response: DatabaseStatsResponse = {
      success: true,
      stats: {
        projects: totalProjects?.count || 0,
        errors: totalErrors?.count || 0,
        sessions: totalSessions?.count || 0,
        sessionEvents: totalSessionEvents?.count || 0,
        networkEvents: totalNetworkEvents?.count || 0,
        lastUpdated: new Date()
      }
    };

    // If project_id is provided, get project-specific stats
    if (params.project_id) {
      const projectErrors = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM errors WHERE project_id = ${params.project_id}
      `;
      
      const projectSessions = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM sessions WHERE project_id = ${params.project_id}
      `;
      
      const projectSessionEvents = await db.queryRow<{ count: number }>`
        SELECT (
          (
            SELECT COUNT(*) 
            FROM session_events se
            JOIN sessions s ON se.session_id = s.session_id
            WHERE s.project_id = ${params.project_id}
          ) + (
            SELECT COUNT(*)
            FROM user_journey_events uje
            WHERE uje.project_id = ${params.project_id}
          )
        ) as count
      `;
      
      const projectNetworkEvents = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count 
        FROM network_events ne
        JOIN sessions s ON ne.session_id = s.session_id
        WHERE s.project_id = ${params.project_id}
      `;

      response.project_specific = {
        project_id: params.project_id,
        errors: projectErrors?.count || 0,
        sessions: projectSessions?.count || 0,
        sessionEvents: projectSessionEvents?.count || 0,
        networkEvents: projectNetworkEvents?.count || 0,
      };
    }

    return response;
  }
);