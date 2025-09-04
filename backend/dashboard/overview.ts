import { api, Query } from "encore.dev/api";
import { db } from "./db";
import { cacheManager } from "../cache/redis-cache";

export interface DashboardOverviewParams {
  days?: Query<number>;
  includeProjectHealth?: Query<boolean>;
}

export interface ProjectHealthSummary {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
  totalErrors: number;
  hasRecentActivity: boolean;
  lastActivity?: Date;
  errorRate: number;
  activeSessions: number;
  status: 'critical' | 'warning' | 'active' | 'healthy' | 'unknown';
}

export interface DashboardOverview {
  success: true;
  summary: {
    totalProjects: number;
    totalErrors: number;
    totalActiveSessions: number;
    totalUniqueUsers: number;
    lastActivity?: Date;
    avgErrorRate: number;
  };
  projectsHealth?: ProjectHealthSummary[];
  recentErrorTrend: Array<{
    date: string;
    count: number;
  }>;
  topErrorMessages: Array<{
    message: string;
    count: number;
    affectedProjects: number;
  }>;
}

/**
 * Aggregated dashboard endpoint that provides all overview data in a single request
 * This replaces multiple individual API calls with one optimized query
 */
export const getDashboardOverview = api<DashboardOverviewParams, DashboardOverview>(
  { expose: true, method: "GET", path: "/api/dashboard/overview" },
  async (params) => {
    const days = params.days || 7;
    const includeProjectHealth = params.includeProjectHealth ?? true;
    
    // Check cache first for significant performance improvement
    const cacheKey = `dashboard_overview_${days}_${includeProjectHealth}`;
    const cachedData = await cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    // Parallel execution of all required queries for maximum performance
    const [
      projectsCount,
      totalErrors,
      totalSessions,
      uniqueUsers,
      lastActivity,
      errorTrend,
      topErrors,
      projectsHealth
    ] = await Promise.all([
      // Total projects count
      db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM projects
      `,
      
      // Total errors in time period
      db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM errors
        WHERE timestamp >= ${startDate}
        AND timestamp <= ${endDate}
      `,
      
      // Total active sessions
      db.queryRow<{ count: number }>`
        SELECT COUNT(DISTINCT session_id) as count
        FROM sessions
        WHERE started_at >= ${startDate}
        AND started_at <= ${endDate}
      `,
      
      // Unique users across all projects
      db.queryRow<{ count: number }>`
        SELECT COUNT(DISTINCT 
          COALESCE(
            (metadata->>'user_id')::text,
            (metadata->>'userId')::text,
            session_id::text
          )
        ) as count
        FROM sessions
        WHERE started_at >= ${startDate}
        AND started_at <= ${endDate}
      `,
      
      // Last activity timestamp
      db.queryRow<{ last_activity: Date }>`
        SELECT MAX(timestamp) as last_activity
        FROM errors
        WHERE timestamp >= ${startDate}
      `,
      
      // Error trend data (optimized single query)
      getErrorTrendData(startDate, endDate, days),
      
      // Top error messages across all projects
      getTopErrorMessages(startDate, endDate),
      
      // Projects health data (conditional)
      includeProjectHealth ? getProjectsHealthData(startDate, endDate, days) : Promise.resolve([])
    ]);
    
    const totalProjectsCount = projectsCount?.count || 0;
    const totalErrorsCount = totalErrors?.count || 0;
    const totalActiveSessionsCount = totalSessions?.count || 0;
    const totalUniqueUsersCount = uniqueUsers?.count || 0;
    
    // Calculate average error rate
    const avgErrorRate = totalProjectsCount > 0 
      ? Math.round((totalErrorsCount / totalProjectsCount / days) * 100) / 100 
      : 0;

    const result: DashboardOverview = {
      success: true,
      summary: {
        totalProjects: totalProjectsCount,
        totalErrors: totalErrorsCount,
        totalActiveSessions: totalActiveSessionsCount,
        totalUniqueUsers: totalUniqueUsersCount,
        lastActivity: lastActivity?.last_activity || undefined,
        avgErrorRate
      },
      projectsHealth: includeProjectHealth ? projectsHealth : undefined,
      recentErrorTrend: errorTrend,
      topErrorMessages: topErrors
    };
    
    // Cache the results for 2 minutes (shorter cache for dashboard data)
    await cacheManager.set(cacheKey, result, 120);
    
    return result;
  }
);

/**
 * Optimized error trend calculation using a single query with date generation
 */
async function getErrorTrendData(startDate: Date, endDate: Date, days: number): Promise<Array<{date: string; count: number}>> {
  const trendResult = await db.queryAll<{
    date: string;
    count: number;
  }>`
    WITH date_series AS (
      SELECT generate_series(
        ${startDate}::date,
        ${endDate}::date,
        '1 day'::interval
      )::date as date
    )
    SELECT 
      ds.date::text as date,
      COALESCE(COUNT(e.id), 0)::int as count
    FROM date_series ds
    LEFT JOIN errors e ON e.timestamp::date = ds.date
    GROUP BY ds.date
    ORDER BY ds.date ASC
  `;
  
  return trendResult.map(row => ({
    date: row.date,
    count: row.count
  }));
}

/**
 * Get top error messages across all projects with project count
 */
async function getTopErrorMessages(startDate: Date, endDate: Date): Promise<Array<{message: string; count: number; affectedProjects: number}>> {
  const topErrorsResult = await db.queryAll<{
    message: string;
    count: number;
    affected_projects: number;
  }>`
    SELECT 
      message,
      COUNT(*) as count,
      COUNT(DISTINCT project_id) as affected_projects
    FROM errors
    WHERE timestamp >= ${startDate}
    AND timestamp <= ${endDate}
    GROUP BY message
    ORDER BY count DESC
    LIMIT 10
  `;
  
  return topErrorsResult.map(row => ({
    message: row.message,
    count: row.count,
    affectedProjects: row.affected_projects
  }));
}

/**
 * Get health data for all projects with optimized queries
 */
async function getProjectsHealthData(startDate: Date, endDate: Date, days: number): Promise<ProjectHealthSummary[]> {
  const projectsHealthResult = await db.queryAll<{
    id: number;
    name: string;
    created_at: Date;
    updated_at: Date;
    total_errors: number;
    last_activity: Date | null;
    active_sessions: number;
  }>`
    SELECT 
      p.id,
      p.name,
      p.created_at,
      p.updated_at,
      COALESCE(error_stats.total_errors, 0) as total_errors,
      error_stats.last_activity,
      COALESCE(session_stats.active_sessions, 0) as active_sessions
    FROM projects p
    LEFT JOIN (
      SELECT 
        project_id,
        COUNT(*) as total_errors,
        MAX(timestamp) as last_activity
      FROM errors
      WHERE timestamp >= ${startDate}
      AND timestamp <= ${endDate}
      GROUP BY project_id
    ) error_stats ON p.id = error_stats.project_id
    LEFT JOIN (
      SELECT 
        project_id,
        COUNT(DISTINCT session_id) as active_sessions
      FROM sessions
      WHERE started_at >= ${startDate}
      AND started_at <= ${endDate}
      GROUP BY project_id
    ) session_stats ON p.id = session_stats.project_id
    ORDER BY p.created_at DESC
  `;
  
  return projectsHealthResult.map(project => {
    const totalErrors = Number(project.total_errors);
    const activeSessions = Number(project.active_sessions);
    const errorRate = Math.round((totalErrors / days) * 100) / 100;
    const hasRecentActivity = project.last_activity !== null;
    
    // Determine health status
    let status: 'critical' | 'warning' | 'active' | 'healthy' | 'unknown';
    if (errorRate > 10) {
      status = 'critical';
    } else if (errorRate > 5) {
      status = 'warning';
    } else if (hasRecentActivity) {
      status = 'active';
    } else if (totalErrors === 0 && activeSessions > 0) {
      status = 'healthy';
    } else {
      status = 'unknown';
    }
    
    return {
      id: project.id,
      name: project.name,
      created_at: project.created_at,
      updated_at: project.updated_at,
      totalErrors,
      hasRecentActivity,
      lastActivity: project.last_activity || undefined,
      errorRate,
      activeSessions,
      status
    };
  });
}

/**
 * Batch health check endpoint for multiple projects
 * Optimizes the current individual project health checks into a single query
 */
export interface BatchHealthCheckParams {
  projectIds: number[];
  days?: Query<number>;
}

export interface BatchHealthCheckResponse {
  success: true;
  projects: Record<number, {
    totalErrors: number;
    hasRecentActivity: boolean;
    lastActivity?: Date;
    errorRate: number;
    activeSessions: number;
    status: 'critical' | 'warning' | 'active' | 'healthy' | 'unknown';
  }>;
}

export const batchHealthCheck = api<BatchHealthCheckParams, BatchHealthCheckResponse>(
  { expose: true, method: "POST", path: "/api/projects/health/batch" },
  async (params) => {
    const { projectIds } = params;
    const days = params.days || 7;
    
    if (!projectIds || projectIds.length === 0) {
      return {
        success: true,
        projects: {}
      };
    }
    
    // Check cache for each project
    const cacheResults: Record<number, any> = {};
    const uncachedIds: number[] = [];
    
    for (const projectId of projectIds) {
      const cached = await cacheManager.getProjectStats(projectId, days);
      if (cached) {
        cacheResults[projectId] = {
          totalErrors: cached.totalErrors,
          hasRecentActivity: cached.totalErrors > 0,
          lastActivity: cached.topErrors[0]?.lastSeen,
          errorRate: cached.errorRate,
          activeSessions: cached.activeSessions,
          status: cached.errorRate > 10 ? 'critical' : 
                  cached.errorRate > 5 ? 'warning' : 
                  cached.totalErrors > 0 ? 'active' : 'healthy'
        };
      } else {
        uncachedIds.push(projectId);
      }
    }
    
    // Batch query for uncached projects
    let batchResults: Record<number, any> = {};
    if (uncachedIds.length > 0) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      
      // For each uncached project, get health data individually (simpler query)
      const healthDataPromises = uncachedIds.map(async (projectId) => {
        const errorStats = await db.queryRow<{
          total_errors: number;
          last_activity: Date | null;
        }>`
          SELECT 
            COUNT(*) as total_errors,
            MAX(timestamp) as last_activity
          FROM errors
          WHERE project_id = ${projectId}
          AND timestamp >= ${startDate}
          AND timestamp <= ${endDate}
        `;
        
        const sessionStats = await db.queryRow<{
          active_sessions: number;
        }>`
          SELECT 
            COUNT(DISTINCT session_id) as active_sessions
          FROM sessions
          WHERE project_id = ${projectId}
          AND started_at >= ${startDate}
          AND started_at <= ${endDate}
        `;
        
        return {
          project_id: projectId,
          total_errors: errorStats?.total_errors || 0,
          last_activity: errorStats?.last_activity || null,
          active_sessions: sessionStats?.active_sessions || 0,
        };
      });
      
      const healthData = await Promise.all(healthDataPromises);
      
      batchResults = healthData.reduce((acc, row) => {
        const totalErrors = Number(row.total_errors);
        const activeSessions = Number(row.active_sessions);
        const errorRate = Math.round((totalErrors / days) * 100) / 100;
        const hasRecentActivity = row.last_activity !== null;
        
        let status: 'critical' | 'warning' | 'active' | 'healthy' | 'unknown';
        if (errorRate > 10) {
          status = 'critical';
        } else if (errorRate > 5) {
          status = 'warning';
        } else if (hasRecentActivity) {
          status = 'active';
        } else if (totalErrors === 0 && activeSessions > 0) {
          status = 'healthy';
        } else {
          status = 'unknown';
        }
        
        acc[row.project_id] = {
          totalErrors,
          hasRecentActivity,
          lastActivity: row.last_activity || undefined,
          errorRate,
          activeSessions,
          status
        };
        
        return acc;
      }, {} as Record<number, any>);
    }
    
    // Combine cached and fresh results
    const allResults = { ...cacheResults, ...batchResults };
    
    return {
      success: true,
      projects: allResults
    };
  }
);