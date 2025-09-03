import { api, Query, APIError } from "encore.dev/api";
import { db } from "./db";

export interface AlertRule {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  is_active: boolean;
  rule_type: 'error_spike' | 'error_rate' | 'performance' | 'custom';
  conditions: Record<string, any>;
  threshold_value?: number;
  threshold_operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  time_window: number; // in seconds
  cooldown_period: number; // in seconds
  severity: 'critical' | 'high' | 'medium' | 'low';
  channels: string[]; // notification channel IDs
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAlertRuleParams {
  project_id: number;
  name: string;
  description?: string;
  rule_type: 'error_spike' | 'error_rate' | 'performance' | 'custom';
  conditions: Record<string, any>;
  threshold_value?: number;
  threshold_operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  time_window?: number;
  cooldown_period?: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  channels: string[];
  created_by?: string;
}

/**
 * Create a new alert rule
 */
export const createAlertRule = api<CreateAlertRuleParams, AlertRule>(
  { expose: true, method: "POST", path: "/api/alerts/rules" },
  async (params) => {
    // Convert threshold_value to proper decimal or null
    const thresholdValue = params.threshold_value !== undefined ? Number(params.threshold_value) : null;
    
    const rule = await db.queryRow<AlertRule>`
      INSERT INTO alert_rules (
        project_id, name, description, rule_type, conditions,
        threshold_value, threshold_operator, time_window, cooldown_period,
        severity, channels, created_by
      ) VALUES (
        ${params.project_id}, ${params.name}, ${params.description || ''},
        ${params.rule_type}, ${JSON.stringify(params.conditions)},
        ${thresholdValue}, ${params.threshold_operator || null},
        ${params.time_window || 300}, ${params.cooldown_period || 3600},
        ${params.severity || 'medium'}, ${JSON.stringify(params.channels)},
        ${params.created_by || null}
      )
      RETURNING *
    `;

    if (!rule) {
      throw new Error("Failed to create alert rule");
    }

    return {
      ...rule,
      conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions,
      channels: typeof rule.channels === 'string' ? JSON.parse(rule.channels) : rule.channels
    };
  }
);

export interface ListAlertRulesParams {
  project_id: number;
  is_active?: Query<boolean>;
  rule_type?: Query<string>;
  page?: Query<number>;
  limit?: Query<number>;
}

/**
 * List alert rules for a project
 */
export const listAlertRules = api<ListAlertRulesParams, { rules: AlertRule[]; total: number }>(
  { expose: true, method: "GET", path: "/api/alerts/rules/by-project/:project_id" },
  async (params) => {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const offset = (page - 1) * limit;

    let whereConditions = "WHERE project_id = $1";
    const queryParams: any[] = [params.project_id];
    let paramIndex = 2;

    if (params.is_active !== undefined) {
      whereConditions += ` AND is_active = $${paramIndex}`;
      queryParams.push(params.is_active);
      paramIndex++;
    }

    if (params.rule_type) {
      whereConditions += ` AND rule_type = $${paramIndex}`;
      queryParams.push(params.rule_type);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) as total FROM alert_rules ${whereConditions}`;
    const dataQuery = `
      SELECT * FROM alert_rules 
      ${whereConditions}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const [countResult, rules] = await Promise.all([
      db.rawQueryRow<{ total: number }>(countQuery, ...queryParams),
      db.rawQueryAll<AlertRule>(dataQuery, ...queryParams, limit, offset)
    ]);

    return {
      rules: rules.map(rule => ({
        ...rule,
        conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions,
        channels: typeof rule.channels === 'string' ? JSON.parse(rule.channels) : rule.channels
      })),
      total: countResult?.total || 0
    };
  }
);

export interface UpdateAlertRuleParams {
  rule_id: number;
  name?: string;
  description?: string;
  is_active?: boolean;
  conditions?: Record<string, any>;
  threshold_value?: number;
  threshold_operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  time_window?: number;
  cooldown_period?: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  channels?: string[];
}

/**
 * Update an alert rule
 */
export const updateAlertRule = api<UpdateAlertRuleParams, AlertRule>(
  { expose: true, method: "PATCH", path: "/api/alerts/rules/:rule_id" },
  async (params) => {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = [
      'name', 'description', 'is_active', 'threshold_value',
      'threshold_operator', 'time_window', 'cooldown_period', 'severity'
    ];

    fields.forEach(field => {
      if (params[field as keyof UpdateAlertRuleParams] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(params[field as keyof UpdateAlertRuleParams]);
        paramIndex++;
      }
    });

    if (params.conditions) {
      updates.push(`conditions = $${paramIndex}`);
      values.push(JSON.stringify(params.conditions));
      paramIndex++;
    }

    if (params.channels) {
      updates.push(`channels = $${paramIndex}`);
      values.push(JSON.stringify(params.channels));
      paramIndex++;
    }

    updates.push("updated_at = NOW()");

    const query = `
      UPDATE alert_rules 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const rule = await db.rawQueryRow<AlertRule>(query, ...values, params.rule_id);

    if (!rule) {
      throw APIError.notFound("Alert rule not found");
    }

    return {
      ...rule,
      conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions,
      channels: typeof rule.channels === 'string' ? JSON.parse(rule.channels) : rule.channels
    };
  }
);

/**
 * Delete an alert rule
 */
export const deleteAlertRule = api<{ rule_id: number }, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/api/alerts/rules/:rule_id" },
  async (params) => {
    const result = await db.exec`
      DELETE FROM alert_rules WHERE id = ${params.rule_id}
    `;

    return { success: true };
  }
);

export interface TestAlertRuleParams {
  rule_id: number;
  test_data?: Record<string, any>;
}

/**
 * Test an alert rule against sample data
 */
export const testAlertRule = api<TestAlertRuleParams, { 
  would_trigger: boolean; 
  evaluation_result: any; 
  next_check_time?: Date 
}>(
  { expose: true, method: "POST", path: "/api/alerts/rules/:rule_id/test" },
  async (params) => {
    const rule = await db.queryRow<AlertRule>`
      SELECT * FROM alert_rules WHERE id = ${params.rule_id}
    `;

    if (!rule) {
      throw APIError.notFound("Alert rule not found");
    }

    const conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
    const testData = params.test_data || await generateTestData(rule.project_id, rule.rule_type);

    const evaluationResult = await evaluateRule(rule, testData);

    return {
      would_trigger: evaluationResult.triggered,
      evaluation_result: evaluationResult,
      next_check_time: evaluationResult.nextCheck
    };
  }
);

/**
 * Rule evaluation logic
 */
export async function evaluateRule(rule: AlertRule, data: Record<string, any>): Promise<{
  triggered: boolean;
  value: number;
  threshold: number;
  nextCheck?: Date;
  context?: Record<string, any>;
}> {
  const conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;

  switch (rule.rule_type) {
    case 'error_spike':
      return evaluateErrorSpike(rule, conditions, data);
    case 'error_rate':
      return evaluateErrorRate(rule, conditions, data);
    case 'performance':
      return evaluatePerformance(rule, conditions, data);
    case 'custom':
      return evaluateCustomRule(rule, conditions, data);
    default:
      return {
        triggered: false,
        value: 0,
        threshold: rule.threshold_value || 0
      };
  }
}

/**
 * Error spike detection
 */
async function evaluateErrorSpike(
  rule: AlertRule,
  conditions: Record<string, any>,
  data: Record<string, any>
): Promise<any> {
  const timeWindow = rule.time_window;
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - timeWindow * 1000);

  // Get current error count
  const currentCount = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count
    FROM errors
    WHERE project_id = ${rule.project_id}
    AND timestamp >= ${startTime}
    AND timestamp <= ${endTime}
  `;

  // Get baseline (previous period)
  const baselineStart = new Date(startTime.getTime() - timeWindow * 1000);
  const baselineCount = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count
    FROM errors
    WHERE project_id = ${rule.project_id}
    AND timestamp >= ${baselineStart}
    AND timestamp < ${startTime}
  `;

  const current = currentCount?.count || 0;
  const baseline = baselineCount?.count || 0;
  const threshold = rule.threshold_value || 0;

  // Calculate spike percentage
  const spikePercentage = baseline > 0 ? ((current - baseline) / baseline) * 100 : current > 0 ? 100 : 0;

  const triggered = compareValue(spikePercentage, threshold, rule.threshold_operator || 'gt');

  return {
    triggered,
    value: spikePercentage,
    threshold,
    context: {
      current_count: current,
      baseline_count: baseline,
      time_window: timeWindow
    }
  };
}

/**
 * Error rate detection
 */
async function evaluateErrorRate(
  rule: AlertRule,
  conditions: Record<string, any>,
  data: Record<string, any>
): Promise<any> {
  const timeWindow = rule.time_window;
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - timeWindow * 1000);

  const errorCount = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count
    FROM errors
    WHERE project_id = ${rule.project_id}
    AND timestamp >= ${startTime}
    AND timestamp <= ${endTime}
  `;

  const count = errorCount?.count || 0;
  const rate = count / (timeWindow / 60); // errors per minute
  const threshold = rule.threshold_value || 0;

  const triggered = compareValue(rate, threshold, rule.threshold_operator || 'gt');

  return {
    triggered,
    value: rate,
    threshold,
    context: {
      error_count: count,
      time_window: timeWindow,
      rate_per_minute: rate
    }
  };
}

/**
 * Performance degradation detection
 */
async function evaluatePerformance(
  rule: AlertRule,
  conditions: Record<string, any>,
  data: Record<string, any>
): Promise<any> {
  const metricName = conditions.metric_name || 'lcp';
  const timeWindow = rule.time_window;
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - timeWindow * 1000);

  const avgMetric = await db.queryRow<{ avg_value: number }>`
    SELECT AVG(metric_value) as avg_value
    FROM performance_metrics
    WHERE project_id = ${rule.project_id}
    AND metric_name = ${metricName}
    AND timestamp >= ${startTime}
    AND timestamp <= ${endTime}
  `;

  const value = avgMetric?.avg_value || 0;
  const threshold = rule.threshold_value || 0;

  const triggered = compareValue(value, threshold, rule.threshold_operator || 'gt');

  return {
    triggered,
    value,
    threshold,
    context: {
      metric_name: metricName,
      time_window: timeWindow
    }
  };
}

/**
 * Custom rule evaluation
 */
async function evaluateCustomRule(
  rule: AlertRule,
  conditions: Record<string, any>,
  data: Record<string, any>
): Promise<any> {
  // Custom rule evaluation would depend on the specific conditions
  // This is a placeholder implementation
  const value = data.value || 0;
  const threshold = rule.threshold_value || 0;

  const triggered = compareValue(value, threshold, rule.threshold_operator || 'gt');

  return {
    triggered,
    value,
    threshold,
    context: conditions
  };
}

/**
 * Compare value against threshold
 */
function compareValue(value: number, threshold: number, operator: string): boolean {
  switch (operator) {
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
    case 'eq':
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Generate test data for rule testing
 */
async function generateTestData(projectId: number, ruleType: string): Promise<Record<string, any>> {
  switch (ruleType) {
    case 'error_spike':
      return { error_count: 100, baseline_count: 20 };
    case 'error_rate':
      return { error_count: 50, time_window: 300 };
    case 'performance':
      return { lcp: 3000, fid: 200, cls: 0.25 };
    default:
      return { value: 75 };
  }
}