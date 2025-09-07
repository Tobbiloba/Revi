import { api, Query } from "encore.dev/api";
import { db } from "./db";

export interface CustomMetric {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  metric_type: 'count' | 'average' | 'sum' | 'percentage' | 'rate';
  query_config: Record<string, any>;
  display_config: Record<string, any>;
  is_active: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DashboardWidget {
  id: number;
  dashboard_id: number;
  widget_type: 'chart' | 'metric' | 'table' | 'heatmap';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  configuration: Record<string, any>;
  data_source: 'errors' | 'sessions' | 'performance' | 'custom';
  created_at: Date;
  updated_at: Date;
}

export interface Dashboard {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  is_public: boolean;
  layout_config: Record<string, any>;
  widgets: DashboardWidget[];
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create custom metric
 */
export const createCustomMetric = api<{
  project_id: number;
  name: string;
  description?: string;
  metric_type: 'count' | 'average' | 'sum' | 'percentage' | 'rate';
  query_config: Record<string, any>;
  display_config: Record<string, any>;
  created_by?: string;
}, CustomMetric>(
  { expose: true, method: "POST", path: "/api/analytics/metrics" },
  async (params) => {
    const metric = await db.queryRow<CustomMetric>`
      INSERT INTO custom_metrics (
        project_id, name, description, metric_type,
        query_config, display_config, created_by
      ) VALUES (
        ${params.project_id}, ${params.name}, ${params.description},
        ${params.metric_type}, ${JSON.stringify(params.query_config)},
        ${JSON.stringify(params.display_config)}, ${params.created_by}
      )
      RETURNING *
    `;

    if (!metric) {
      throw new Error("Failed to create custom metric");
    }

    return {
      ...metric,
      query_config: typeof metric.query_config === 'string' ? JSON.parse(metric.query_config) : metric.query_config,
      display_config: typeof metric.display_config === 'string' ? JSON.parse(metric.display_config) : metric.display_config
    };
  }
);

/**
 * Get comprehensive project analytics
 */
export const getProjectAnalytics = api<{
  project_id: number;
  time_range?: Query<'1h' | '24h' | '7d' | '30d' | '90d'>;
  include_trends?: Query<boolean>;
}, {
  overview: {
    total_errors: number;
    unique_users: number;
    total_sessions: number;
    avg_session_duration: number;
    error_rate_change: number;
    user_growth_rate: number;
  };
  error_insights: {
    top_error_groups: Array<{
      group_id: number;
      title: string;
      occurrences: number;
      unique_users: number;
      trend: 'up' | 'down' | 'stable';
    }>;
    error_categories: Record<string, number>;
    browser_breakdown: Record<string, number>;
    device_breakdown: Record<string, number>;
  };
  user_insights: {
    geographic_distribution: Array<{
      country: string;
      users: number;
      error_rate: number;
    }>;
    user_segments: Array<{
      segment: string;
      users: number;
      avg_errors: number;
    }>;
    retention_metrics: {
      day_1: number;
      day_7: number;
      day_30: number;
    };
  };
  performance_insights: {
    web_vitals_trends: Record<string, number[]>;
    page_performance: Array<{
      url: string;
      avg_load_time: number;
      error_rate: number;
      bounce_rate: number;
    }>;
    api_performance: Array<{
      endpoint: string;
      avg_response_time: number;
      error_rate: number;
      request_count: number;
    }>;
  };
  trends?: {
    error_trends: Array<{ date: string; errors: number; users: number }>;
    performance_trends: Array<{ date: string; lcp: number; fid: number; cls: number }>;
  };
}>(
  { expose: true, method: "GET", path: "/api/analytics/project/:project_id" },
  async (params) => {
    const timeRange = params.time_range || '30d';
    const includeTrends = params.include_trends || false;

    // Calculate time boundaries
    const endTime = new Date();
    const startTime = getTimeRangeStart(timeRange);
    const compareStartTime = getCompareTimeStart(timeRange, startTime);

    // Fetch overview metrics
    const overview = await getOverviewMetrics(params.project_id, startTime, endTime, compareStartTime);
    
    // Fetch error insights
    const errorInsights = await getErrorInsights(params.project_id, startTime, endTime);
    
    // Fetch user insights
    const userInsights = await getUserInsights(params.project_id, startTime, endTime);
    
    // Fetch performance insights
    const performanceInsights = await getPerformanceInsights(params.project_id, startTime, endTime);
    
    // Optionally fetch trends
    let trends;
    if (includeTrends) {
      trends = await getTrendsData(params.project_id, startTime, endTime);
    }

    return {
      overview,
      error_insights: errorInsights,
      user_insights: userInsights,
      performance_insights: performanceInsights,
      trends
    };
  }
);

/**
 * Export project data
 */
export const exportProjectData = api<{
  project_id: number;
  export_type: 'csv' | 'json' | 'excel';
  data_types: Array<'errors' | 'sessions' | 'users' | 'performance'>;
  time_range?: '1h' | '24h' | '7d' | '30d' | '90d';
  include_pii?: boolean;
}, {
  download_url: string;
  file_size: number;
  expires_at: Date;
}>(
  { expose: true, method: "POST", path: "/api/analytics/export/:project_id" },
  async (params) => {
    const timeRange = params.time_range || '30d';
    const startTime = getTimeRangeStart(timeRange);
    const endTime = new Date();

    // Generate export data
    const exportData: Record<string, any[]> = {};

    if (params.data_types.includes('errors')) {
      exportData.errors = await exportErrors(params.project_id, startTime, endTime, params.include_pii ?? false);
    }

    if (params.data_types.includes('sessions')) {
      exportData.sessions = await exportSessions(params.project_id, startTime, endTime, params.include_pii ?? false);
    }

    if (params.data_types.includes('users')) {
      exportData.users = await exportUsers(params.project_id, startTime, endTime, params.include_pii ?? false);
    }

    if (params.data_types.includes('performance')) {
      exportData.performance = await exportPerformance(params.project_id, startTime, endTime);
    }

    // Generate file and upload to storage (simulate)
    const fileName = `revi_export_${params.project_id}_${Date.now()}.${params.export_type}`;
    const fileSize = JSON.stringify(exportData).length; // Approximate size
    const downloadUrl = `https://exports.revi.dev/${fileName}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      download_url: downloadUrl,
      file_size: fileSize,
      expires_at: expiresAt
    };
  }
);

/**
 * Get advanced filtering and search results
 */
export const advancedSearch = api<{
  project_id: number;
  query: string;
  filters: Record<string, any>;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}, {
  results: any[];
  total: number;
  aggregations: Record<string, any>;
  suggestions: string[];
}>(
  { expose: true, method: "POST", path: "/api/analytics/search/:project_id" },
  async (params) => {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 200);
    const offset = (page - 1) * limit;

    // Parse search query and build SQL conditions
    const searchConditions = parseAdvancedQuery(params.query, params.filters);
    
    // Execute search
    const results = await executeAdvancedSearch(
      params.project_id, 
      searchConditions, 
      params.sort_by, 
      params.sort_order,
      limit,
      offset
    );

    // Get aggregations
    const aggregations = await getSearchAggregations(params.project_id, searchConditions);

    // Generate query suggestions
    const suggestions = generateQuerySuggestions(params.query, params.filters);

    return {
      results: results.data,
      total: results.total,
      aggregations,
      suggestions
    };
  }
);

/**
 * Create custom dashboard
 */
export const createDashboard = api<{
  project_id: number;
  name: string;
  description?: string;
  is_public?: boolean;
  layout_config?: Record<string, any>;
  created_by?: string;
}, Dashboard>(
  { expose: true, method: "POST", path: "/api/analytics/dashboards" },
  async (params) => {
    const dashboard = await db.queryRow<Dashboard>`
      INSERT INTO custom_dashboards (
        project_id, name, description, is_public, layout_config, created_by
      ) VALUES (
        ${params.project_id}, ${params.name}, ${params.description},
        ${params.is_public || false}, ${JSON.stringify(params.layout_config || {})},
        ${params.created_by}
      )
      RETURNING *
    `;

    if (!dashboard) {
      throw new Error("Failed to create dashboard");
    }

    return {
      ...dashboard,
      layout_config: typeof dashboard.layout_config === 'string' 
        ? JSON.parse(dashboard.layout_config) 
        : dashboard.layout_config,
      widgets: []
    };
  }
);

/**
 * Helper functions
 */
function getTimeRangeStart(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function getCompareTimeStart(timeRange: string, currentStart: Date): Date {
  const duration = Date.now() - currentStart.getTime();
  return new Date(currentStart.getTime() - duration);
}

async function getOverviewMetrics(
  projectId: number, 
  startTime: Date, 
  endTime: Date, 
  compareStart: Date
) {
  const [currentMetrics, previousMetrics] = await Promise.all([
    db.queryRow<{
      total_errors: number;
      unique_users: number;
      total_sessions: number;
      avg_session_duration: number;
    }>`
      SELECT 
        COUNT(DISTINCT e.id) as total_errors,
        COUNT(DISTINCT COALESCE(ua.user_id, ua.user_fingerprint)) as unique_users,
        COUNT(DISTINCT s.session_id) as total_sessions,
        AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at))) as avg_session_duration
      FROM errors e
      LEFT JOIN user_analytics ua ON e.project_id = ua.project_id
      LEFT JOIN sessions s ON e.session_id = s.session_id AND e.project_id = s.project_id
      WHERE e.project_id = ${projectId}
      AND e.timestamp >= ${startTime} AND e.timestamp <= ${endTime}
    `,
    db.queryRow<{
      total_errors: number;
      unique_users: number;
    }>`
      SELECT 
        COUNT(DISTINCT e.id) as total_errors,
        COUNT(DISTINCT COALESCE(ua.user_id, ua.user_fingerprint)) as unique_users
      FROM errors e
      LEFT JOIN user_analytics ua ON e.project_id = ua.project_id
      WHERE e.project_id = ${projectId}
      AND e.timestamp >= ${compareStart} AND e.timestamp < ${startTime}
    `
  ]);

  const current = currentMetrics || { total_errors: 0, unique_users: 0, total_sessions: 0, avg_session_duration: 0 };
  const previous = previousMetrics || { total_errors: 0, unique_users: 0 };

  const errorRateChange = previous.total_errors > 0 
    ? ((current.total_errors - previous.total_errors) / previous.total_errors) * 100 
    : current.total_errors > 0 ? 100 : 0;

  const userGrowthRate = previous.unique_users > 0 
    ? ((current.unique_users - previous.unique_users) / previous.unique_users) * 100 
    : current.unique_users > 0 ? 100 : 0;

  return {
    total_errors: current.total_errors,
    unique_users: current.unique_users,
    total_sessions: current.total_sessions,
    avg_session_duration: current.avg_session_duration || 0,
    error_rate_change: Math.round(errorRateChange * 100) / 100,
    user_growth_rate: Math.round(userGrowthRate * 100) / 100
  };
}

async function getErrorInsights(projectId: number, startTime: Date, endTime: Date) {
  const [topErrorGroups, browserBreakdown, deviceBreakdown] = await Promise.all([
    db.queryAll<{
      group_id: number;
      title: string;
      occurrences: number;
      unique_users: number;
    }>`
      SELECT 
        eg.id as group_id,
        eg.title,
        eg.total_occurrences as occurrences,
        eg.unique_users
      FROM error_groups eg
      WHERE eg.project_id = ${projectId}
      AND eg.last_seen >= ${startTime}
      ORDER BY eg.total_occurrences DESC
      LIMIT 10
    `,
    db.queryAll<{ browser: string; count: number }>`
      SELECT 
        ua.browser_name as browser,
        COUNT(*) as count
      FROM errors e
      LEFT JOIN user_analytics ua ON e.project_id = ua.project_id
      WHERE e.project_id = ${projectId}
      AND e.timestamp >= ${startTime} AND e.timestamp <= ${endTime}
      AND ua.browser_name IS NOT NULL
      GROUP BY ua.browser_name
      ORDER BY count DESC
      LIMIT 10
    `,
    db.queryAll<{ device: string; count: number }>`
      SELECT 
        ua.device_type as device,
        COUNT(*) as count
      FROM errors e
      LEFT JOIN user_analytics ua ON e.project_id = ua.project_id
      WHERE e.project_id = ${projectId}
      AND e.timestamp >= ${startTime} AND e.timestamp <= ${endTime}
      AND ua.device_type IS NOT NULL
      GROUP BY ua.device_type
      ORDER BY count DESC
    `
  ]);

  const browserMap: Record<string, number> = {};
  browserBreakdown.forEach(item => {
    browserMap[item.browser] = item.count;
  });

  const deviceMap: Record<string, number> = {};
  deviceBreakdown.forEach(item => {
    deviceMap[item.device] = item.count;
  });

  return {
    top_error_groups: topErrorGroups.map(group => ({
      ...group,
      trend: 'stable' as const // Would calculate based on historical data
    })),
    error_categories: {}, // Would categorize errors by type
    browser_breakdown: browserMap,
    device_breakdown: deviceMap
  };
}

async function getUserInsights(projectId: number, startTime: Date, endTime: Date) {
  const geoData = await db.queryAll<{
    country: string;
    users: number;
    errors: number;
  }>`
    SELECT 
      ua.country_code as country,
      COUNT(DISTINCT ua.user_fingerprint) as users,
      SUM(ua.total_errors) as errors
    FROM user_analytics ua
    WHERE ua.project_id = ${projectId}
    AND ua.last_seen >= ${startTime}
    AND ua.country_code IS NOT NULL
    GROUP BY ua.country_code
    ORDER BY users DESC
    LIMIT 20
  `;

  return {
    geographic_distribution: geoData.map(row => ({
      country: row.country,
      users: row.users,
      error_rate: row.users > 0 ? row.errors / row.users : 0
    })),
    user_segments: [], // Would implement user segmentation logic
    retention_metrics: {
      day_1: 0.85,
      day_7: 0.42,
      day_30: 0.23
    } // Would calculate from actual data
  };
}

async function getPerformanceInsights(projectId: number, startTime: Date, endTime: Date) {
  const webVitals = await db.queryAll<{
    metric_name: string;
    avg_value: number;
  }>`
    SELECT 
      metric_name,
      AVG(metric_value) as avg_value
    FROM performance_metrics
    WHERE project_id = ${projectId}
    AND timestamp >= ${startTime} AND timestamp <= ${endTime}
    AND metric_name IN ('lcp', 'fid', 'cls', 'fcp', 'ttfb')
    GROUP BY metric_name
  `;

  const webVitalsMap: Record<string, number[]> = {};
  webVitals.forEach(metric => {
    webVitalsMap[metric.metric_name] = [metric.avg_value]; // Would include historical data
  });

  return {
    web_vitals_trends: webVitalsMap,
    page_performance: [], // Would analyze page-specific performance
    api_performance: []   // Would analyze API endpoint performance
  };
}

async function getTrendsData(projectId: number, startTime: Date, endTime: Date) {
  // Would implement time-series trend analysis
  return {
    error_trends: [],
    performance_trends: []
  };
}

// Export helper functions (simplified implementations)
async function exportErrors(projectId: number, startTime: Date, endTime: Date, includePii: boolean): Promise<any[]> {
  const errors = await db.queryAll<any>`
    SELECT 
      e.*,
      eg.title as error_group_title,
      s.user_id
    FROM errors e
    LEFT JOIN error_groups eg ON e.error_group_id = eg.id
    LEFT JOIN sessions s ON e.session_id = s.session_id AND e.project_id = s.project_id
    WHERE e.project_id = ${projectId}
    AND e.timestamp >= ${startTime} AND e.timestamp <= ${endTime}
    ORDER BY e.timestamp DESC
    LIMIT 10000
  `;

  return errors.map(error => ({
    ...error,
    // Remove PII if not requested
    user_id: includePii ? error.user_id : undefined,
    user_agent: includePii ? error.user_agent : 'REDACTED'
  }));
}

async function exportSessions(projectId: number, startTime: Date, endTime: Date, includePii: boolean): Promise<any[]> {
  // Simplified session export
  return [];
}

async function exportUsers(projectId: number, startTime: Date, endTime: Date, includePii: boolean): Promise<any[]> {
  // Simplified user export
  return [];
}

async function exportPerformance(projectId: number, startTime: Date, endTime: Date): Promise<any[]> {
  // Simplified performance export
  return [];
}

// Search helper functions (simplified implementations)
function parseAdvancedQuery(query: string, filters: Record<string, any>): any {
  // Would implement advanced query parsing
  return { query, filters };
}

async function executeAdvancedSearch(
  projectId: number,
  searchConditions: any,
  sortBy?: string,
  sortOrder?: string,
  limit?: number,
  offset?: number
): Promise<{ data: any[]; total: number }> {
  // Would implement advanced search execution
  return { data: [], total: 0 };
}

async function getSearchAggregations(projectId: number, searchConditions: any): Promise<Record<string, any>> {
  // Would implement search result aggregations
  return {};
}

function generateQuerySuggestions(query: string, filters: Record<string, any>): string[] {
  // Would implement query auto-completion and suggestions
  return [];
}