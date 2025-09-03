import { api, Query } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { db } from "./db";

export interface PerformanceBaseline {
  id: number;
  project_id: number;
  metric_name: string;
  url_pattern?: string;
  baseline_value: number;
  baseline_p95: number;
  baseline_p99: number;
  sample_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface PerformanceRegression {
  id: number;
  project_id: number;
  metric_name: string;
  url_pattern?: string;
  baseline_value: number;
  current_value: number;
  regression_percentage: number;
  severity: 'minor' | 'major' | 'critical';
  detected_at: Date;
  status: 'active' | 'resolved' | 'false_positive';
  resolution_notes?: string;
}

/**
 * API endpoint for cron job to detect performance regressions
 */
export const detectPerformanceRegressionsEndpoint = api(
  { method: "POST", expose: false, path: "/internal/performance/detect-regressions" },
  async (): Promise<void> => {
    try {
      await checkAllProjectsForRegressions();
    } catch (error) {
      console.error("Performance regression detection error:", error);
    }
  }
);

/**
 * Detect performance regressions by analyzing metrics against baselines
 */
export const detectPerformanceRegressions = new CronJob("performance-regression", {
  title: "Performance Regression Detection",
  every: "15m", // Check every 15 minutes
  endpoint: detectPerformanceRegressionsEndpoint,
});

/**
 * Check all projects for performance regressions
 */
async function checkAllProjectsForRegressions(): Promise<void> {
  const projects = await db.queryAll<{ id: number }>`
    SELECT DISTINCT project_id as id FROM performance_metrics
    WHERE timestamp >= NOW() - INTERVAL '1 hour'
  `;

  for (const project of projects) {
    await checkProjectPerformanceRegressions(project.id);
  }
}

/**
 * Check a specific project for performance regressions
 */
async function checkProjectPerformanceRegressions(projectId: number): Promise<void> {
  const metricTypes = ['lcp', 'fid', 'cls', 'fcp', 'ttfb'];
  
  for (const metricName of metricTypes) {
    await checkMetricRegression(projectId, metricName);
  }
}

/**
 * Check for regression in a specific metric
 */
async function checkMetricRegression(projectId: number, metricName: string): Promise<void> {
  // Get baseline for this metric
  const baseline = await getOrCreateBaseline(projectId, metricName);
  if (!baseline) return;

  // Get current performance data (last 15 minutes)
  const currentMetrics = await db.queryAll<{
    url: string;
    avg_value: number;
    p95_value: number;
    p99_value: number;
    sample_count: number;
  }>`
    SELECT 
      url,
      AVG(metric_value) as avg_value,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value) as p95_value,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY metric_value) as p99_value,
      COUNT(*) as sample_count
    FROM performance_metrics
    WHERE project_id = ${projectId}
    AND metric_name = ${metricName}
    AND timestamp >= NOW() - INTERVAL '15 minutes'
    AND metric_value > 0
    GROUP BY url
    HAVING COUNT(*) >= 5
  `;

  for (const current of currentMetrics) {
    await checkForRegression(projectId, metricName, baseline, current);
  }
}

/**
 * Get or create performance baseline
 */
async function getOrCreateBaseline(projectId: number, metricName: string): Promise<PerformanceBaseline | null> {
  // Check for existing baseline
  let baseline = await db.queryRow<PerformanceBaseline>`
    SELECT * FROM performance_baselines
    WHERE project_id = ${projectId} AND metric_name = ${metricName}
    AND updated_at >= NOW() - INTERVAL '7 days'
  `;

  if (!baseline) {
    // Create new baseline from last 7 days of stable data
    const baselineData = await db.queryRow<{
      avg_value: number;
      p95_value: number;
      p99_value: number;
      sample_count: number;
    }>`
      SELECT 
        AVG(metric_value) as avg_value,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value) as p95_value,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY metric_value) as p99_value,
        COUNT(*) as sample_count
      FROM performance_metrics
      WHERE project_id = ${projectId}
      AND metric_name = ${metricName}
      AND timestamp >= NOW() - INTERVAL '7 days'
      AND timestamp <= NOW() - INTERVAL '1 hour'
      AND metric_value > 0
      HAVING COUNT(*) >= 100
    `;

    if (baselineData && baselineData.sample_count >= 100) {
      baseline = await db.queryRow<PerformanceBaseline>`
        INSERT INTO performance_baselines (
          project_id, metric_name, baseline_value, baseline_p95, 
          baseline_p99, sample_count
        ) VALUES (
          ${projectId}, ${metricName}, ${baselineData.avg_value},
          ${baselineData.p95_value}, ${baselineData.p99_value}, ${baselineData.sample_count}
        )
        ON CONFLICT (project_id, metric_name)
        DO UPDATE SET
          baseline_value = ${baselineData.avg_value},
          baseline_p95 = ${baselineData.p95_value},
          baseline_p99 = ${baselineData.p99_value},
          sample_count = ${baselineData.sample_count},
          updated_at = NOW()
        RETURNING *
      `;
    }
  }

  return baseline || null;
}

/**
 * Check if current metrics indicate a regression
 */
async function checkForRegression(
  projectId: number,
  metricName: string,
  baseline: PerformanceBaseline,
  current: any
): Promise<void> {
  // Calculate regression thresholds based on metric type
  const thresholds = getMetricThresholds(metricName);
  
  // For timing metrics (LCP, FCP, TTFB), higher is worse
  // For CLS, higher is worse
  // For FID, higher is worse
  
  const regressionPercentage = ((current.avg_value - baseline.baseline_value) / baseline.baseline_value) * 100;
  
  let severity: 'minor' | 'major' | 'critical' | null = null;
  
  if (regressionPercentage >= thresholds.critical) {
    severity = 'critical';
  } else if (regressionPercentage >= thresholds.major) {
    severity = 'major';
  } else if (regressionPercentage >= thresholds.minor) {
    severity = 'minor';
  }

  if (severity) {
    await recordRegression(
      projectId,
      metricName,
      current.url,
      baseline.baseline_value,
      current.avg_value,
      regressionPercentage,
      severity
    );
  }
}

/**
 * Get regression thresholds for different metrics
 */
function getMetricThresholds(metricName: string): { minor: number; major: number; critical: number } {
  const thresholds = {
    lcp: { minor: 20, major: 50, critical: 100 },      // 20%, 50%, 100% increase
    fid: { minor: 25, major: 75, critical: 150 },      // 25%, 75%, 150% increase  
    cls: { minor: 30, major: 100, critical: 200 },     // 30%, 100%, 200% increase
    fcp: { minor: 25, major: 60, critical: 120 },      // 25%, 60%, 120% increase
    ttfb: { minor: 30, major: 80, critical: 150 }      // 30%, 80%, 150% increase
  };

  return thresholds[metricName as keyof typeof thresholds] || { minor: 25, major: 50, critical: 100 };
}

/**
 * Record a performance regression
 */
async function recordRegression(
  projectId: number,
  metricName: string,
  urlPattern: string,
  baselineValue: number,
  currentValue: number,
  regressionPercentage: number,
  severity: 'minor' | 'major' | 'critical'
): Promise<void> {
  // Check if regression already exists for this metric/URL combination
  const existingRegression = await db.queryRow<PerformanceRegression>`
    SELECT * FROM performance_regressions
    WHERE project_id = ${projectId}
    AND metric_name = ${metricName}
    AND url_pattern = ${urlPattern}
    AND status = 'active'
  `;

  if (existingRegression) {
    // Update existing regression
    await db.exec`
      UPDATE performance_regressions
      SET current_value = ${currentValue},
          regression_percentage = ${regressionPercentage},
          severity = ${severity},
          detected_at = NOW()
      WHERE id = ${existingRegression.id}
    `;
  } else {
    // Create new regression record
    await db.queryRow<PerformanceRegression>`
      INSERT INTO performance_regressions (
        project_id, metric_name, url_pattern, baseline_value,
        current_value, regression_percentage, severity
      ) VALUES (
        ${projectId}, ${metricName}, ${urlPattern}, ${baselineValue},
        ${currentValue}, ${regressionPercentage}, ${severity}
      )
      RETURNING *
    `;

    // Trigger alert for significant regressions
    if (severity === 'critical' || severity === 'major') {
      await triggerPerformanceAlert(projectId, metricName, urlPattern, severity, regressionPercentage);
    }
  }
}

/**
 * Trigger performance regression alert
 */
async function triggerPerformanceAlert(
  projectId: number,
  metricName: string,
  urlPattern: string,
  severity: string,
  regressionPercentage: number
): Promise<void> {
  // This would integrate with the alerting system
  // For now, we'll log the alert
  console.log(`Performance Alert: ${severity} regression detected in ${metricName} for ${urlPattern}: ${regressionPercentage.toFixed(1)}% degradation`);
}

/**
 * API endpoints for performance regression management
 */

export const getPerformanceRegressions = api<{
  project_id: number;
  status?: Query<'active' | 'resolved' | 'false_positive'>;
  severity?: Query<'minor' | 'major' | 'critical'>;
  metric_name?: Query<string>;
  limit?: Query<number>;
}, {
  regressions: PerformanceRegression[];
  total: number;
}>(
  { expose: true, method: "GET", path: "/api/intelligence/performance-regressions/by-project/:project_id" },
  async (params) => {
    let whereConditions = "WHERE project_id = $1";
    const queryParams: any[] = [params.project_id];
    let paramIndex = 2;

    if (params.status) {
      whereConditions += ` AND status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    if (params.severity) {
      whereConditions += ` AND severity = $${paramIndex}`;
      queryParams.push(params.severity);
      paramIndex++;
    }

    if (params.metric_name) {
      whereConditions += ` AND metric_name = $${paramIndex}`;
      queryParams.push(params.metric_name);
      paramIndex++;
    }

    const limit = Math.min(params.limit || 50, 100);

    const [regressions, total] = await Promise.all([
      db.rawQueryAll<PerformanceRegression>(
        `SELECT * FROM performance_regressions 
         ${whereConditions}
         ORDER BY detected_at DESC 
         LIMIT $${paramIndex}`,
        ...queryParams, limit
      ),
      db.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM performance_regressions ${whereConditions}`,
        ...queryParams
      )
    ]);

    return {
      regressions,
      total: total?.count || 0
    };
  }
);

export const updateRegressionStatus = api<{
  regression_id: number;
  status: 'active' | 'resolved' | 'false_positive';
  resolution_notes?: string;
}, { success: boolean }>(
  { expose: true, method: "PATCH", path: "/api/intelligence/performance-regressions/:regression_id" },
  async (params) => {
    await db.exec`
      UPDATE performance_regressions
      SET status = ${params.status},
          resolution_notes = ${params.resolution_notes},
          updated_at = NOW()
      WHERE id = ${params.regression_id}
    `;

    return { success: true };
  }
);

export const getPerformanceBaselines = api<{
  project_id: number;
}, {
  baselines: PerformanceBaseline[];
}>(
  { expose: true, method: "GET", path: "/api/intelligence/performance-baselines/:project_id" },
  async (params) => {
    const baselines = await db.queryAll<PerformanceBaseline>`
      SELECT * FROM performance_baselines
      WHERE project_id = ${params.project_id}
      ORDER BY metric_name, updated_at DESC
    `;

    return { baselines };
  }
);