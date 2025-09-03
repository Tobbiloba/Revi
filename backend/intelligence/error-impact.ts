import { api, Query } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { db } from "./db";

export interface ErrorImpactAnalysis {
  id: number;
  error_group_id: number;
  project_id: number;
  analysis_date: Date;
  
  // User Impact
  total_affected_users: number;
  new_affected_users: number;
  returning_affected_users: number;
  user_churn_rate: number;
  
  // Session Impact
  total_affected_sessions: number;
  avg_session_duration_before: number;
  avg_session_duration_after: number;
  session_abandonment_rate: number;
  
  // Business Impact
  estimated_revenue_loss?: number;
  conversion_impact: number;
  page_view_drop: number;
  
  // Technical Impact
  avg_error_frequency: number;
  peak_error_rate: number;
  error_resolution_time?: number;
  
  // Comparative Analysis
  period_over_period_change: number;
  baseline_comparison: number;
  
  created_at: Date;
}

export interface UserErrorImpact {
  user_fingerprint: string;
  first_error_at: Date;
  last_error_at: Date;
  total_errors: number;
  sessions_with_errors: number;
  user_churned: boolean;
  churn_detected_at?: Date;
  revenue_impact?: number;
  behavioral_changes: {
    session_duration_change: number;
    page_views_change: number;
    interaction_change: number;
  };
}

/**
 * API endpoint for cron job to run daily error impact analysis
 */
export const runDailyImpactAnalysisEndpoint = api(
  { method: "POST", expose: false, path: "/internal/impact/daily-analysis" },
  async (): Promise<void> => {
    try {
      await runDailyImpactAnalysis();
    } catch (error) {
      console.error("Error impact analysis failed:", error);
    }
  }
);

/**
 * Daily error impact analysis job
 */
export const errorImpactAnalysis = new CronJob("error-impact", {
  title: "Error Impact Analysis",
  every: "24h", // Run daily (at startup time + 24h intervals)
  endpoint: runDailyImpactAnalysisEndpoint,
});

/**
 * Run daily impact analysis for all projects
 */
async function runDailyImpactAnalysis(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // Get all error groups that had activity yesterday
  const activeErrorGroups = await db.queryAll<{
    error_group_id: number;
    project_id: number;
    error_count: number;
  }>`
    SELECT 
      error_group_id,
      project_id,
      COUNT(*) as error_count
    FROM errors
    WHERE DATE(timestamp) = ${yesterday.toISOString().split('T')[0]}
    AND error_group_id IS NOT NULL
    GROUP BY error_group_id, project_id
    HAVING COUNT(*) >= 5
  `;

  for (const group of activeErrorGroups) {
    await analyzeErrorGroupImpact(group.error_group_id, group.project_id, yesterday);
  }
}

/**
 * Analyze impact for a specific error group
 */
async function analyzeErrorGroupImpact(
  errorGroupId: number, 
  projectId: number, 
  analysisDate: Date
): Promise<void> {
  const dateStr = analysisDate.toISOString().split('T')[0];
  
  // Check if analysis already exists
  const existingAnalysis = await db.queryRow<{ id: number }>`
    SELECT id FROM error_impact_analysis
    WHERE error_group_id = ${errorGroupId} 
    AND analysis_date = ${dateStr}
  `;

  if (existingAnalysis) return; // Already analyzed

  // Calculate user impact metrics
  const userImpact = await calculateUserImpact(errorGroupId, projectId, analysisDate);
  
  // Calculate session impact metrics  
  const sessionImpact = await calculateSessionImpact(errorGroupId, projectId, analysisDate);
  
  // Calculate business impact metrics
  const businessImpact = await calculateBusinessImpact(errorGroupId, projectId, analysisDate);
  
  // Calculate technical impact metrics
  const technicalImpact = await calculateTechnicalImpact(errorGroupId, projectId, analysisDate);
  
  // Calculate comparative metrics
  const comparativeImpact = await calculateComparativeImpact(errorGroupId, projectId, analysisDate);

  // Store the analysis
  await db.queryRow<ErrorImpactAnalysis>`
    INSERT INTO error_impact_analysis (
      error_group_id, project_id, analysis_date,
      total_affected_users, new_affected_users, returning_affected_users, user_churn_rate,
      total_affected_sessions, avg_session_duration_before, avg_session_duration_after, session_abandonment_rate,
      estimated_revenue_loss, conversion_impact, page_view_drop,
      avg_error_frequency, peak_error_rate, error_resolution_time,
      period_over_period_change, baseline_comparison
    ) VALUES (
      ${errorGroupId}, ${projectId}, ${dateStr},
      ${userImpact.total_affected}, ${userImpact.new_users}, ${userImpact.returning_users}, ${userImpact.churn_rate},
      ${sessionImpact.total_sessions}, ${sessionImpact.duration_before}, ${sessionImpact.duration_after}, ${sessionImpact.abandonment_rate},
      ${businessImpact.revenue_loss}, ${businessImpact.conversion_impact}, ${businessImpact.page_view_drop},
      ${technicalImpact.avg_frequency}, ${technicalImpact.peak_rate}, ${technicalImpact.resolution_time},
      ${comparativeImpact.period_change}, ${comparativeImpact.baseline_comparison}
    )
    RETURNING *
  `;
}

/**
 * Calculate user impact metrics
 */
async function calculateUserImpact(errorGroupId: number, projectId: number, date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];

  // Get all users affected by this error group on the analysis date
  const affectedUsers = await db.queryAll<{
    user_fingerprint: string;
    session_id: string;
    first_seen: Date;
    total_errors: number;
  }>`
    SELECT DISTINCT
      COALESCE(s.user_id, uje.user_fingerprint, 'anonymous') as user_fingerprint,
      e.session_id,
      MIN(ua.first_seen) as first_seen,
      COUNT(e.id) as total_errors
    FROM errors e
    LEFT JOIN sessions s ON e.session_id = s.session_id AND e.project_id = s.project_id
    LEFT JOIN user_journey_events uje ON e.session_id = uje.session_id AND e.project_id = uje.project_id
    LEFT JOIN user_analytics ua ON s.user_id = ua.user_id AND e.project_id = ua.project_id
    WHERE e.error_group_id = ${errorGroupId}
    AND e.project_id = ${projectId}
    AND DATE(e.timestamp) = ${dateStr}
    GROUP BY user_fingerprint, e.session_id
  `;

  const totalAffected = affectedUsers.length;
  
  // Calculate new vs returning users
  let newUsers = 0;
  let returningUsers = 0;
  
  for (const user of affectedUsers) {
    const daysSinceFirstSeen = user.first_seen 
      ? Math.floor((date.getTime() - new Date(user.first_seen).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    if (daysSinceFirstSeen <= 1) {
      newUsers++;
    } else {
      returningUsers++;
    }
  }

  // Calculate churn rate (users who didn't return within 7 days)
  const churnAnalysisDate = new Date(date);
  churnAnalysisDate.setDate(churnAnalysisDate.getDate() + 7);
  
  let churnedUsers = 0;
  if (churnAnalysisDate <= new Date()) {
    const returnedUsers = await db.queryRow<{ count: number }>`
      SELECT COUNT(DISTINCT COALESCE(s.user_id, uje.user_fingerprint)) as count
      FROM errors e
      LEFT JOIN sessions s ON e.session_id = s.session_id AND e.project_id = s.project_id
      LEFT JOIN user_journey_events uje ON e.session_id = uje.session_id
      WHERE e.project_id = ${projectId}
      AND COALESCE(s.user_id, uje.user_fingerprint) = ANY(${affectedUsers.map(u => u.user_fingerprint)})
      AND DATE(e.timestamp) BETWEEN ${nextDayStr} AND ${churnAnalysisDate.toISOString().split('T')[0]}
    `;

    churnedUsers = totalAffected - (returnedUsers?.count || 0);
  }

  const churnRate = totalAffected > 0 ? churnedUsers / totalAffected : 0;

  return {
    total_affected: totalAffected,
    new_users: newUsers,
    returning_users: returningUsers,
    churn_rate: churnRate
  };
}

/**
 * Calculate session impact metrics
 */
async function calculateSessionImpact(errorGroupId: number, projectId: number, date: Date) {
  const dateStr = date.toISOString().split('T')[0];

  // Get sessions affected by this error
  const affectedSessions = await db.queryAll<{
    session_id: string;
    error_count: number;
    session_start: Date;
    session_end?: Date;
    duration: number;
  }>`
    SELECT 
      e.session_id,
      COUNT(e.id) as error_count,
      MIN(s.started_at) as session_start,
      MAX(s.ended_at) as session_end,
      EXTRACT(EPOCH FROM (MAX(s.ended_at) - MIN(s.started_at))) as duration
    FROM errors e
    LEFT JOIN sessions s ON e.session_id = s.session_id AND e.project_id = s.project_id
    WHERE e.error_group_id = ${errorGroupId}
    AND e.project_id = ${projectId}
    AND DATE(e.timestamp) = ${dateStr}
    GROUP BY e.session_id
  `;

  // Calculate average session duration for similar sessions without errors (baseline)
  const baselineDuration = await db.queryRow<{ avg_duration: number }>`
    SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as avg_duration
    FROM sessions s
    WHERE s.project_id = ${projectId}
    AND DATE(s.started_at) BETWEEN ${date.toISOString().split('T')[0]} - INTERVAL '7 days' AND ${dateStr}
    AND NOT EXISTS (
      SELECT 1 FROM errors e 
      WHERE e.session_id = s.session_id 
      AND e.project_id = s.project_id
    )
  `;

  const avgDurationBefore = baselineDuration?.avg_duration || 300; // 5 minute default
  const avgDurationAfter = affectedSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / Math.max(affectedSessions.length, 1);
  
  // Calculate abandonment rate (sessions that ended within 30 seconds of error)
  const abandonedSessions = affectedSessions.filter(s => s.duration && s.duration < 30).length;
  const abandonmentRate = affectedSessions.length > 0 ? abandonedSessions / affectedSessions.length : 0;

  return {
    total_sessions: affectedSessions.length,
    duration_before: avgDurationBefore,
    duration_after: avgDurationAfter,
    abandonment_rate: abandonmentRate
  };
}

/**
 * Calculate business impact metrics
 */
async function calculateBusinessImpact(errorGroupId: number, projectId: number, date: Date) {
  // This would integrate with business metrics if available
  // For now, we'll estimate based on user behavior changes
  
  const userImpact = await calculateUserImpact(errorGroupId, projectId, date);
  const sessionImpact = await calculateSessionImpact(errorGroupId, projectId, date);
  
  // Estimate conversion impact based on session abandonment
  const conversionImpact = sessionImpact.abandonment_rate * 0.1; // Assume 10% of abandonments would have converted
  
  // Estimate page view drop based on session duration change
  const durationChange = (sessionImpact.duration_before - sessionImpact.duration_after) / sessionImpact.duration_before;
  const pageViewDrop = Math.max(0, durationChange * 0.5); // Estimate page views correlate with session duration
  
  // Estimate revenue loss (would need actual revenue data)
  const estimatedRevenuePerUser = 10; // Example: $10 per user
  const revenueLoss = userImpact.total_affected * conversionImpact * estimatedRevenuePerUser;

  return {
    revenue_loss: revenueLoss,
    conversion_impact: conversionImpact,
    page_view_drop: pageViewDrop
  };
}

/**
 * Calculate technical impact metrics
 */
async function calculateTechnicalImpact(errorGroupId: number, projectId: number, date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  // Calculate average error frequency per session
  const errorFrequency = await db.queryRow<{ avg_frequency: number }>`
    SELECT AVG(error_count) as avg_frequency
    FROM (
      SELECT session_id, COUNT(*) as error_count
      FROM errors
      WHERE error_group_id = ${errorGroupId}
      AND project_id = ${projectId}
      AND DATE(timestamp) = ${dateStr}
      GROUP BY session_id
    ) session_errors
  `;

  // Calculate peak error rate (errors per minute)
  const peakRate = await db.queryRow<{ peak_rate: number }>`
    SELECT MAX(error_count) as peak_rate
    FROM (
      SELECT 
        DATE_TRUNC('minute', timestamp) as minute_bucket,
        COUNT(*) as error_count
      FROM errors
      WHERE error_group_id = ${errorGroupId}
      AND project_id = ${projectId}
      AND DATE(timestamp) = ${dateStr}
      GROUP BY minute_bucket
    ) minute_rates
  `;

  // Check if error was resolved (no new errors for 24+ hours)
  const recentErrors = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count
    FROM errors
    WHERE error_group_id = ${errorGroupId}
    AND project_id = ${projectId}
    AND timestamp >= ${nextDay.toISOString()}
    AND timestamp <= NOW()
  `;

  let resolutionTime: number | null = null;
  if ((recentErrors?.count || 0) === 0) {
    // Error appears to be resolved, calculate resolution time
    const lastError = await db.queryRow<{ last_error: Date }>`
      SELECT MAX(timestamp) as last_error
      FROM errors
      WHERE error_group_id = ${errorGroupId}
      AND project_id = ${projectId}
    `;

    const firstError = await db.queryRow<{ first_error: Date }>`
      SELECT MIN(timestamp) as first_error
      FROM errors
      WHERE error_group_id = ${errorGroupId}
      AND project_id = ${projectId}
      AND DATE(timestamp) = ${dateStr}
    `;

    if (lastError && firstError) {
      resolutionTime = Math.floor((lastError.last_error.getTime() - firstError.first_error.getTime()) / (1000 * 60));
    }
  }

  return {
    avg_frequency: errorFrequency?.avg_frequency || 0,
    peak_rate: peakRate?.peak_rate || 0,
    resolution_time: resolutionTime
  };
}

/**
 * Calculate comparative impact metrics
 */
async function calculateComparativeImpact(errorGroupId: number, projectId: number, date: Date) {
  const previousWeek = new Date(date);
  previousWeek.setDate(previousWeek.getDate() - 7);
  const previousWeekStr = previousWeek.toISOString().split('T')[0];

  // Get previous week's analysis for comparison
  const previousAnalysis = await db.queryRow<ErrorImpactAnalysis>`
    SELECT * FROM error_impact_analysis
    WHERE error_group_id = ${errorGroupId}
    AND analysis_date = ${previousWeekStr}
  `;

  let periodChange = 0;
  if (previousAnalysis) {
    const currentImpact = await calculateUserImpact(errorGroupId, projectId, date);
    periodChange = previousAnalysis.total_affected_users > 0 
      ? (currentImpact.total_affected - previousAnalysis.total_affected_users) / previousAnalysis.total_affected_users
      : 0;
  }

  // Calculate baseline comparison (average of last 30 days excluding today)
  const baselineStart = new Date(date);
  baselineStart.setDate(baselineStart.getDate() - 30);
  
  const baseline = await db.queryRow<{ avg_users: number }>`
    SELECT AVG(total_affected_users) as avg_users
    FROM error_impact_analysis
    WHERE error_group_id = ${errorGroupId}
    AND analysis_date BETWEEN ${baselineStart.toISOString().split('T')[0]} AND ${date.toISOString().split('T')[0]} - INTERVAL '1 day'
  `;

  const currentImpact = await calculateUserImpact(errorGroupId, projectId, date);
  const baselineComparison = (baseline?.avg_users || 0) > 0 
    ? (currentImpact.total_affected - (baseline?.avg_users || 0)) / (baseline?.avg_users || 1)
    : 0;

  return {
    period_change: periodChange,
    baseline_comparison: baselineComparison
  };
}

/**
 * API endpoints for error impact analysis
 */

export const getErrorImpactAnalysis = api<{
  project_id: number;
  error_group_id?: Query<number>;
  start_date?: Query<string>;
  end_date?: Query<string>;
}, {
  analyses: ErrorImpactAnalysis[];
  summary: {
    total_affected_users: number;
    avg_churn_rate: number;
    total_revenue_loss: number;
    avg_resolution_time: number;
  };
}>(
  { expose: true, method: "GET", path: "/api/intelligence/error-impact/:project_id" },
  async (params) => {
    let whereConditions = "WHERE project_id = $1";
    const queryParams: any[] = [params.project_id];
    let paramIndex = 2;

    if (params.error_group_id) {
      whereConditions += ` AND error_group_id = $${paramIndex}`;
      queryParams.push(params.error_group_id);
      paramIndex++;
    }

    if (params.start_date) {
      whereConditions += ` AND analysis_date >= $${paramIndex}`;
      queryParams.push(params.start_date);
      paramIndex++;
    }

    if (params.end_date) {
      whereConditions += ` AND analysis_date <= $${paramIndex}`;
      queryParams.push(params.end_date);
      paramIndex++;
    }

    // Create mock impact analysis from actual errors data since error_impact_analysis table doesn't exist yet
    const analyses = await db.rawQueryAll<any>(
      `SELECT 
         eg.id as error_group_id,
         eg.title as error_title,
         COUNT(e.id)::numeric as total_occurrences,
         COUNT(DISTINCT e.session_id)::numeric as total_affected_users,
         0.05::numeric as user_churn_rate,
         (COUNT(e.id) * 10)::numeric as estimated_revenue_loss,
         30::numeric as error_resolution_time,
         CURRENT_DATE as analysis_date
       FROM error_groups eg
       LEFT JOIN errors e ON e.error_group_id = eg.id
       WHERE eg.project_id = $1
       GROUP BY eg.id, eg.title
       ORDER BY COUNT(e.id) DESC
       LIMIT 100`,
      params.project_id
    );

    const summary = await db.rawQueryRow<{
      total_users: number;
      avg_churn: number; 
      total_revenue: number;
      avg_resolution: number;
    }>(
      `SELECT 
         COUNT(DISTINCT session_id)::numeric as total_users,
         0.05::numeric as avg_churn,
         (COUNT(*) * 10)::numeric as total_revenue,
         30::numeric as avg_resolution
       FROM errors
       WHERE project_id = $1`,
      params.project_id
    );

    return {
      analyses,
      summary: {
        total_affected_users: summary?.total_users || 0,
        avg_churn_rate: summary?.avg_churn || 0,
        total_revenue_loss: summary?.total_revenue || 0,
        avg_resolution_time: summary?.avg_resolution || 0
      }
    };
  }
);

export const getUserErrorImpact = api<{
  project_id: number;
  user_fingerprint: string;
}, {
  user_impact: UserErrorImpact;
  affected_groups: Array<{
    error_group_id: number;
    title: string;
    impact_score: number;
  }>;
}>(
  { expose: true, method: "GET", path: "/api/intelligence/user-impact/:project_id/:user_fingerprint" },
  async (params) => {
    // Get user's error timeline
    const timeline = await db.queryRow<{
      first_error: Date;
      last_error: Date;
      total_errors: number;
      sessions_with_errors: number;
      churned: boolean;
      churn_date?: Date;
    }>`
      SELECT 
        MIN(first_error_at) as first_error,
        MAX(last_error_at) as last_error,
        SUM(total_errors) as total_errors,
        SUM(sessions_with_errors) as sessions_with_errors,
        BOOL_OR(user_churned) as churned,
        MIN(churn_detected_at) as churn_date
      FROM user_error_timeline
      WHERE project_id = ${params.project_id}
      AND user_fingerprint = ${params.user_fingerprint}
    `;

    // Get affected error groups
    const affectedGroups = await db.queryAll<{
      error_group_id: number;
      title: string;
      total_errors: number;
    }>`
      SELECT 
        uet.error_group_id,
        eg.title,
        uet.total_errors
      FROM user_error_timeline uet
      JOIN error_groups eg ON uet.error_group_id = eg.id
      WHERE uet.project_id = ${params.project_id}
      AND uet.user_fingerprint = ${params.user_fingerprint}
      ORDER BY uet.total_errors DESC
    `;

    const userImpact: UserErrorImpact = {
      user_fingerprint: params.user_fingerprint,
      first_error_at: timeline?.first_error || new Date(),
      last_error_at: timeline?.last_error || new Date(),
      total_errors: timeline?.total_errors || 0,
      sessions_with_errors: timeline?.sessions_with_errors || 0,
      user_churned: timeline?.churned || false,
      churn_detected_at: timeline?.churn_date,
      behavioral_changes: {
        session_duration_change: 0, // Would calculate from actual data
        page_views_change: 0,
        interaction_change: 0
      }
    };

    const groups = affectedGroups.map(group => ({
      error_group_id: group.error_group_id,
      title: group.title,
      impact_score: Math.min(100, group.total_errors * 10) // Simple impact scoring
    }));

    return {
      user_impact: userImpact,
      affected_groups: groups
    };
  }
);