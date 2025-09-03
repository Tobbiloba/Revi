import { api, Query } from "encore.dev/api";
import { db } from "./db";
import { parseUserAgent, groupBrowserForAnalytics, groupOSForAnalytics } from "./user-agent-parser";
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
    
    // Get browser distribution from user agents
    const browserDataResult = await db.queryAll<{ user_agent: string; count: number }>`
      SELECT 
        user_agent,
        COUNT(*) as count
      FROM errors
      WHERE project_id = ${projectId}
      AND timestamp >= ${startDate}
      AND timestamp <= ${endDate}
      AND user_agent IS NOT NULL
      AND user_agent != ''
      GROUP BY user_agent
      ORDER BY count DESC
      LIMIT 50
    `;
    
    const browserMap = new Map<string, number>();
    const osMap = new Map<string, number>();
    
    browserDataResult.forEach(row => {
      const parsed = parseUserAgent(row.user_agent);
      const browserKey = groupBrowserForAnalytics(parsed.browser, parsed.browserVersion);
      const osKey = groupOSForAnalytics(parsed.os, parsed.osVersion);
      
      browserMap.set(browserKey, (browserMap.get(browserKey) || 0) + row.count);
      osMap.set(osKey, (osMap.get(osKey) || 0) + row.count);
    });
    
    const totalBrowsers = Array.from(browserMap.values()).reduce((sum, count) => sum + count, 0);
    const totalOS = Array.from(osMap.values()).reduce((sum, count) => sum + count, 0);
    
    const browserDistribution = Array.from(browserMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([browser, count]) => ({
        browser: browser.split(' ')[0], // Browser name
        version: browser.includes(' ') ? browser.split(' ')[1] : undefined,
        count,
        percentage: totalBrowsers > 0 ? Math.round((count / totalBrowsers) * 100 * 100) / 100 : 0
      }));
    
    const osDistribution = Array.from(osMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([os, count]) => ({
        os: os.split(' ')[0], // OS name
        version: os.includes(' ') ? os.split(' ')[1] : undefined,
        count,
        percentage: totalOS > 0 ? Math.round((count / totalOS) * 100 * 100) / 100 : 0
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
      SELECT COUNT(*) as count FROM session_events
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
        SELECT COUNT(*) as count 
        FROM session_events se
        JOIN sessions s ON se.session_id = s.session_id
        WHERE s.project_id = ${params.project_id}
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