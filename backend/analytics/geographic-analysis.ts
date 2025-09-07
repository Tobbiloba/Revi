import { api, Query } from "encore.dev/api";
import { db } from "./db";

export interface GeographicErrorData {
  country_code: string;
  country_name: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  error_count: number;
  unique_users: number;
  error_rate: number; // errors per user
  top_errors: Array<{
    error_group_id: number;
    title: string;
    count: number;
  }>;
  performance_impact: {
    avg_load_time: number;
    avg_lcp: number;
    avg_fid: number;
  };
}

export interface DeviceErrorBreakdown {
  device_type: string;
  browser_name: string;
  browser_version: string;
  os_name: string;
  os_version: string;
  error_count: number;
  unique_users: number;
  error_rate: number;
  common_errors: Array<{
    error_group_id: number;
    title: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Get geographic error distribution
 */
export const getGeographicErrorDistribution = api<{
  project_id: number;
  time_range?: Query<'1h' | '24h' | '7d' | '30d'>;
  error_group_id?: Query<number>;
  min_errors?: Query<number>;
}, {
  geographic_data: GeographicErrorData[];
  total_countries: number;
  total_errors: number;
  top_affected_countries: string[];
}>(
  { expose: true, method: "GET", path: "/api/analytics/geographic-errors/:project_id" },
  async (params) => {
    const timeRange = params.time_range || '7d';
    const minErrors = params.min_errors || 1;

    // Calculate time boundaries
    const endTime = new Date();
    const startTime = getTimeRangeStart(timeRange);

    let whereConditions = `
      WHERE e.project_id = $1 
      AND e.timestamp >= $2 
      AND e.timestamp <= $3
      AND ga.country_code IS NOT NULL
    `;
    const queryParams: any[] = [params.project_id, startTime, endTime];
    let paramIndex = 4;

    if (params.error_group_id) {
      whereConditions += ` AND e.error_group_id = $${paramIndex}`;
      queryParams.push(params.error_group_id);
      paramIndex++;
    }

    // Get geographic error data
    const geoDataQuery = `
      SELECT 
        ga.country_code,
        ga.country_name,
        ga.city,
        ga.region,
        ga.latitude,
        ga.longitude,
        COUNT(DISTINCT e.id) as error_count,
        COUNT(DISTINCT COALESCE(ua.user_id, ua.user_fingerprint)) as unique_users,
        AVG(ga.avg_load_time) as avg_load_time
      FROM errors e
      JOIN user_analytics ua ON e.project_id = ua.project_id
      JOIN geo_analytics ga ON ua.country_code = ga.country_code 
        AND ua.project_id = ga.project_id
        AND DATE(e.timestamp) = DATE(ga.time_bucket)
      ${whereConditions}
      GROUP BY ga.country_code, ga.country_name, ga.city, ga.region, ga.latitude, ga.longitude
      HAVING COUNT(DISTINCT e.id) >= $${paramIndex}
      ORDER BY error_count DESC
      LIMIT 100
    `;

    const geoData = await db.rawQueryAll<{
      country_code: string;
      country_name: string;
      city?: string;
      region?: string;
      latitude?: number;
      longitude?: number;
      error_count: number;
      unique_users: number;
      avg_load_time?: number;
    }>(geoDataQuery, ...queryParams, minErrors);

    // Get performance data for each location
    const geographicData: GeographicErrorData[] = [];
    
    for (const location of geoData) {
      // Get top errors for this location
      const topErrors = await db.queryAll<{
        error_group_id: number;
        title: string;
        count: number;
      }>`
        SELECT 
          eg.id as error_group_id,
          eg.title,
          COUNT(e.id) as count
        FROM errors e
        JOIN error_groups eg ON e.error_group_id = eg.id
        JOIN user_analytics ua ON e.project_id = ua.project_id
        WHERE e.project_id = ${params.project_id}
        AND e.timestamp >= ${startTime}
        AND e.timestamp <= ${endTime}
        AND ua.country_code = ${location.country_code}
        ${params.error_group_id ? `AND e.error_group_id = ${params.error_group_id}` : ''}
        GROUP BY eg.id, eg.title
        ORDER BY count DESC
        LIMIT 5
      `;

      // Get performance metrics for this location
      const performanceData = await db.queryRow<{
        avg_lcp: number;
        avg_fid: number;
      }>`
        SELECT 
          AVG(CASE WHEN pm.metric_name = 'lcp' THEN pm.metric_value END) as avg_lcp,
          AVG(CASE WHEN pm.metric_name = 'fid' THEN pm.metric_value END) as avg_fid
        FROM performance_metrics pm
        JOIN user_analytics ua ON pm.project_id = ua.project_id
        WHERE pm.project_id = ${params.project_id}
        AND pm.timestamp >= ${startTime}
        AND pm.timestamp <= ${endTime}
        AND ua.country_code = ${location.country_code}
        AND pm.metric_name IN ('lcp', 'fid')
      `;

      geographicData.push({
        country_code: location.country_code,
        country_name: location.country_name,
        city: location.city,
        region: location.region,
        latitude: location.latitude,
        longitude: location.longitude,
        error_count: location.error_count,
        unique_users: location.unique_users,
        error_rate: location.unique_users > 0 ? location.error_count / location.unique_users : 0,
        top_errors: topErrors,
        performance_impact: {
          avg_load_time: location.avg_load_time || 0,
          avg_lcp: performanceData?.avg_lcp || 0,
          avg_fid: performanceData?.avg_fid || 0
        }
      });
    }

    // Calculate summary stats
    const totalCountries = geoData.length;
    const totalErrors = geoData.reduce((sum, d) => sum + d.error_count, 0);
    const topCountries = geoData.slice(0, 5).map(d => d.country_name);

    return {
      geographic_data: geographicData,
      total_countries: totalCountries,
      total_errors: totalErrors,
      top_affected_countries: topCountries
    };
  }
);

/**
 * Get detailed device and browser error breakdown
 */
export const getDeviceErrorBreakdown = api<{
  project_id: number;
  time_range?: Query<'1h' | '24h' | '7d' | '30d'>;
  error_group_id?: Query<number>;
}, {
  device_breakdown: DeviceErrorBreakdown[];
  browser_summary: Record<string, number>;
  os_summary: Record<string, number>;
  mobile_vs_desktop: {
    mobile_errors: number;
    desktop_errors: number;
    mobile_rate: number;
    desktop_rate: number;
  };
}>(
  { expose: true, method: "GET", path: "/api/analytics/device-errors/:project_id" },
  async (params) => {
    const timeRange = params.time_range || '7d';
    const startTime = getTimeRangeStart(timeRange);
    const endTime = new Date();

    let whereConditions = `
      WHERE e.project_id = $1 
      AND e.timestamp >= $2 
      AND e.timestamp <= $3
    `;
    const queryParams: any[] = [params.project_id, startTime, endTime];
    let paramIndex = 4;

    if (params.error_group_id) {
      whereConditions += ` AND e.error_group_id = $${paramIndex}`;
      queryParams.push(params.error_group_id);
      paramIndex++;
    }

    // Get device breakdown
    const deviceData = await db.rawQueryAll<{
      device_type: string;
      browser_name: string;
      browser_version: string;
      os_name: string;
      os_version: string;
      error_count: number;
      unique_users: number;
    }>(
      `SELECT 
        COALESCE(ua.device_type, 'unknown') as device_type,
        COALESCE(ua.browser_name, 'unknown') as browser_name,
        COALESCE(ua.browser_version, 'unknown') as browser_version,
        COALESCE(ua.os_name, 'unknown') as os_name,
        COALESCE(ua.os_version, 'unknown') as os_version,
        COUNT(DISTINCT e.id) as error_count,
        COUNT(DISTINCT COALESCE(ua.user_id, ua.user_fingerprint)) as unique_users
       FROM errors e
       LEFT JOIN user_analytics ua ON e.project_id = ua.project_id
       ${whereConditions}
       GROUP BY device_type, browser_name, browser_version, os_name, os_version
       HAVING COUNT(DISTINCT e.id) >= 1
       ORDER BY error_count DESC
       LIMIT 50`,
      ...queryParams
    );

    // Get common errors for each device combination
    const deviceBreakdown: DeviceErrorBreakdown[] = [];
    
    for (const device of deviceData) {
      const commonErrors = await db.queryAll<{
        error_group_id: number;
        title: string;
        count: number;
      }>`
        SELECT 
          eg.id as error_group_id,
          eg.title,
          COUNT(e.id) as count
        FROM errors e
        JOIN error_groups eg ON e.error_group_id = eg.id
        LEFT JOIN user_analytics ua ON e.project_id = ua.project_id
        WHERE e.project_id = ${params.project_id}
        AND e.timestamp >= ${startTime}
        AND e.timestamp <= ${endTime}
        AND COALESCE(ua.device_type, 'unknown') = ${device.device_type}
        AND COALESCE(ua.browser_name, 'unknown') = ${device.browser_name}
        AND COALESCE(ua.os_name, 'unknown') = ${device.os_name}
        ${params.error_group_id ? `AND e.error_group_id = ${params.error_group_id}` : ''}
        GROUP BY eg.id, eg.title
        ORDER BY count DESC
        LIMIT 3
      `;

      deviceBreakdown.push({
        device_type: device.device_type,
        browser_name: device.browser_name,
        browser_version: device.browser_version,
        os_name: device.os_name,
        os_version: device.os_version,
        error_count: device.error_count,
        unique_users: device.unique_users,
        error_rate: device.unique_users > 0 ? device.error_count / device.unique_users : 0,
        common_errors: commonErrors.map(error => ({
          ...error,
          percentage: device.error_count > 0 ? (error.count / device.error_count) * 100 : 0
        }))
      });
    }

    // Generate summaries
    const browserSummary: Record<string, number> = {};
    const osSummary: Record<string, number> = {};
    let mobileErrors = 0;
    let desktopErrors = 0;

    deviceData.forEach(device => {
      // Browser summary
      const browser = `${device.browser_name} ${device.browser_version}`.trim();
      browserSummary[browser] = (browserSummary[browser] || 0) + device.error_count;

      // OS summary  
      const os = `${device.os_name} ${device.os_version}`.trim();
      osSummary[os] = (osSummary[os] || 0) + device.error_count;

      // Mobile vs desktop
      if (device.device_type === 'mobile' || device.device_type === 'tablet') {
        mobileErrors += device.error_count;
      } else {
        desktopErrors += device.error_count;
      }
    });

    const totalErrors = mobileErrors + desktopErrors;
    
    return {
      device_breakdown: deviceBreakdown,
      browser_summary: browserSummary,
      os_summary: osSummary,
      mobile_vs_desktop: {
        mobile_errors: mobileErrors,
        desktop_errors: desktopErrors,
        mobile_rate: totalErrors > 0 ? (mobileErrors / totalErrors) * 100 : 0,
        desktop_rate: totalErrors > 0 ? (desktopErrors / totalErrors) * 100 : 0
      }
    };
  }
);

/**
 * Get error correlation with user attributes
 */
export const getErrorCorrelationAnalysis = api<{
  project_id: number;
  error_group_id: number;
  time_range?: Query<'1h' | '24h' | '7d' | '30d'>;
}, {
  user_segments: Array<{
    segment_name: string;
    segment_value: string;
    error_rate: number;
    user_count: number;
    correlation_strength: number; // -1 to 1
  }>;
  strongest_correlations: Array<{
    attribute: string;
    correlation: number;
    description: string;
  }>;
  recommendations: string[];
}>(
  { expose: true, method: "GET", path: "/api/analytics/error-correlation/:project_id/:error_group_id" },
  async (params) => {
    const timeRange = params.time_range || '7d';
    const startTime = getTimeRangeStart(timeRange);
    const endTime = new Date();

    // Analyze different user segments and their error rates
    const segments = await analyzeUserSegments(params.project_id, params.error_group_id, startTime, endTime);
    
    // Find strongest correlations
    const correlations = calculateCorrelations(segments);
    
    // Generate recommendations
    const recommendations = generateRecommendations(correlations, segments);

    return {
      user_segments: segments,
      strongest_correlations: correlations,
      recommendations
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
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

async function analyzeUserSegments(
  projectId: number, 
  errorGroupId: number, 
  startTime: Date, 
  endTime: Date
): Promise<Array<{
  segment_name: string;
  segment_value: string;
  error_rate: number;
  user_count: number;
  correlation_strength: number;
}>> {
  // Analyze by browser
  const browserSegments = await db.queryAll<{
    browser_name: string;
    user_count: number;
    error_count: number;
  }>`
    SELECT 
      ua.browser_name,
      COUNT(DISTINCT COALESCE(ua.user_id, ua.user_fingerprint)) as user_count,
      COUNT(DISTINCT CASE WHEN e.error_group_id = ${errorGroupId} THEN e.id END) as error_count
    FROM user_analytics ua
    LEFT JOIN errors e ON ua.project_id = e.project_id 
      AND e.timestamp >= ${startTime} AND e.timestamp <= ${endTime}
    WHERE ua.project_id = ${projectId}
    AND ua.browser_name IS NOT NULL
    GROUP BY ua.browser_name
    HAVING COUNT(DISTINCT COALESCE(ua.user_id, ua.user_fingerprint)) >= 10
  `;

  // Analyze by device type
  const deviceSegments = await db.queryAll<{
    device_type: string;
    user_count: number;
    error_count: number;
  }>`
    SELECT 
      ua.device_type,
      COUNT(DISTINCT COALESCE(ua.user_id, ua.user_fingerprint)) as user_count,
      COUNT(DISTINCT CASE WHEN e.error_group_id = ${errorGroupId} THEN e.id END) as error_count
    FROM user_analytics ua
    LEFT JOIN errors e ON ua.project_id = e.project_id 
      AND e.timestamp >= ${startTime} AND e.timestamp <= ${endTime}
    WHERE ua.project_id = ${projectId}
    AND ua.device_type IS NOT NULL
    GROUP BY ua.device_type
    HAVING COUNT(DISTINCT COALESCE(ua.user_id, ua.user_fingerprint)) >= 10
  `;

  const segments: Array<{
    segment_name: string;
    segment_value: string;
    error_rate: number;
    user_count: number;
    correlation_strength: number;
  }> = [];

  // Process browser segments
  browserSegments.forEach(browser => {
    const errorRate = browser.user_count > 0 ? browser.error_count / browser.user_count : 0;
    segments.push({
      segment_name: 'Browser',
      segment_value: browser.browser_name,
      error_rate: errorRate,
      user_count: browser.user_count,
      correlation_strength: 0 // Will be calculated later
    });
  });

  // Process device segments
  deviceSegments.forEach(device => {
    const errorRate = device.user_count > 0 ? device.error_count / device.user_count : 0;
    segments.push({
      segment_name: 'Device',
      segment_value: device.device_type,
      error_rate: errorRate,
      user_count: device.user_count,
      correlation_strength: 0 // Will be calculated later
    });
  });

  // Calculate correlation strength (simplified)
  const avgErrorRate = segments.reduce((sum, s) => sum + s.error_rate, 0) / segments.length;
  segments.forEach(segment => {
    segment.correlation_strength = (segment.error_rate - avgErrorRate) / avgErrorRate;
  });

  return segments;
}

function calculateCorrelations(segments: any[]): Array<{
  attribute: string;
  correlation: number;
  description: string;
}> {
  const correlations: Array<{
    attribute: string;
    correlation: number;
    description: string;
  }> = [];

  // Group by segment name and find strongest correlations
  const segmentGroups = segments.reduce((groups, segment) => {
    if (!groups[segment.segment_name]) {
      groups[segment.segment_name] = [];
    }
    groups[segment.segment_name].push(segment);
    return groups;
  }, {} as Record<string, any[]>);

  Object.entries(segmentGroups).forEach(([name, segmentList]) => {
    // Find segment with highest error rate
    const segments = segmentList as any[];
    const maxErrorSegment = segments.reduce((max: any, segment: any) => 
      segment.error_rate > max.error_rate ? segment : max
    );

    if (maxErrorSegment.error_rate > 0) {
      correlations.push({
        attribute: name,
        correlation: maxErrorSegment.correlation_strength,
        description: `${maxErrorSegment.segment_value} shows ${(maxErrorSegment.error_rate * 100).toFixed(1)}% error rate`
      });
    }
  });

  return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

function generateRecommendations(correlations: any[], segments: any[]): string[] {
  const recommendations: string[] = [];

  correlations.forEach(correlation => {
    if (Math.abs(correlation.correlation) > 0.2) {
      if (correlation.correlation > 0) {
        recommendations.push(`High error rates detected for ${correlation.attribute}. Consider testing specifically on ${correlation.description.split(' shows ')[0]}.`);
      }
    }
  });

  // Add general recommendations
  if (recommendations.length === 0) {
    recommendations.push("Error rates appear consistent across user segments. Focus on general error fixes.");
  }

  return recommendations;
}