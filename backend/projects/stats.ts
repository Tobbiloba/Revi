import { api, Query } from "encore.dev/api";
import { db } from "./db";

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
}

// Gets comprehensive statistics and metrics for a project over a specified time period.
export const getProjectStats = api<ProjectStatsParams, ProjectStats>(
  { expose: true, method: "GET", path: "/api/projects/:projectId/stats" },
  async (params) => {
    const days = params.days || 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    // Get total error count for the period
    const totalErrorsResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM errors
      WHERE project_id = ${params.projectId}
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
      WHERE project_id = ${params.projectId}
      AND started_at >= ${startDate}
      AND started_at <= ${endDate}
    `;
    
    const activeSessions = activeSessionsResult?.count || 0;
    
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
      WHERE project_id = ${params.projectId}
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
        WHERE project_id = ${params.projectId}
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
      topErrors,
      errorTrend: trendData
    };
  }
);

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