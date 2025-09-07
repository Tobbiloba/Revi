import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { db } from "./db";
import { evaluateRule, AlertRule } from "./rules";
import { sendNotification } from "./notifications";

export interface AlertHistory {
  id: number;
  alert_rule_id: number;
  project_id: number;
  triggered_at: Date;
  resolved_at?: Date;
  status: 'triggered' | 'resolved' | 'acknowledged';
  trigger_value: number;
  context_data: Record<string, any>;
  notification_sent: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolution_notes?: string;
  created_at: Date;
}

/**
 * API endpoint for cron job to check all alerts
 */
export const checkAllAlertsEndpoint = api(
  { method: "POST", expose: false, path: "/internal/alerts/check-all" },
  async (): Promise<void> => {
    await checkAllAlerts();
  }
);

/**
 * Background job to monitor and trigger alerts
 */
export const alertMonitor = new CronJob("alert-monitor", {
  title: "Alert Monitor",
  every: "1m", // Check alerts every minute
  endpoint: checkAllAlertsEndpoint,
});

/**
 * Check all active alert rules
 */
async function checkAllAlerts(): Promise<void> {
  const activeRules = await db.queryAll<AlertRule>`
    SELECT * FROM alert_rules 
    WHERE is_active = true
    ORDER BY severity DESC, created_at ASC
  `;

  for (const rule of activeRules) {
    try {
      await checkAlertRule(rule);
    } catch (error) {
      console.error(`Error checking alert rule ${rule.id}:`, error);
    }
  }
}

/**
 * Check a specific alert rule
 */
async function checkAlertRule(rule: AlertRule): Promise<void> {
  // Check cooldown period
  if (await isInCooldown(rule)) {
    return;
  }

  // Evaluate the rule
  const evaluationResult = await evaluateRule(rule, {});

  if (evaluationResult.triggered) {
    await triggerAlert(rule, evaluationResult);
  } else {
    // Check if we should resolve any existing alerts
    await checkAlertResolution(rule);
  }
}

/**
 * Check if alert rule is in cooldown period
 */
async function isInCooldown(rule: AlertRule): Promise<boolean> {
  const cooldownStart = new Date(Date.now() - rule.cooldown_period * 1000);
  
  const recentAlert = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count
    FROM alert_history
    WHERE alert_rule_id = ${rule.id}
    AND status = 'triggered'
    AND triggered_at > ${cooldownStart}
  `;

  return (recentAlert?.count || 0) > 0;
}

/**
 * Trigger an alert
 */
async function triggerAlert(rule: AlertRule, evaluationResult: any): Promise<void> {
  // Check if there's already an active alert for this rule
  const existingAlert = await db.queryRow<AlertHistory>`
    SELECT * FROM alert_history
    WHERE alert_rule_id = ${rule.id}
    AND status = 'triggered'
    ORDER BY triggered_at DESC
    LIMIT 1
  `;

  if (existingAlert) {
    // Update existing alert with new trigger value
    await db.exec`
      UPDATE alert_history
      SET trigger_value = ${evaluationResult.value},
          context_data = ${JSON.stringify(evaluationResult.context || {})},
          updated_at = NOW()
      WHERE id = ${existingAlert.id}
    `;
    return;
  }

  // Create new alert history entry
  const alertHistory = await db.queryRow<AlertHistory>`
    INSERT INTO alert_history (
      alert_rule_id, project_id, trigger_value, context_data
    ) VALUES (
      ${rule.id}, ${rule.project_id}, ${evaluationResult.value},
      ${JSON.stringify(evaluationResult.context || {})}
    )
    RETURNING *
  `;

  if (!alertHistory) {
    throw new Error("Failed to create alert history");
  }

  // Send notifications
  try {
    const channels = typeof rule.channels === 'string' ? JSON.parse(rule.channels) : rule.channels;
    
    if (channels && channels.length > 0) {
      const title = `Alert: ${rule.name}`;
      const message = formatAlertMessage(rule, evaluationResult);
      
      const notificationResult = await sendNotification({
        channel_ids: channels.map((id: any) => parseInt(id)),
        title,
        message,
        severity: rule.severity,
        alert_id: alertHistory.id,
        metadata: {
          rule_type: rule.rule_type,
          project_id: rule.project_id,
          evaluation_result: evaluationResult
        }
      });

      // Update notification status
      await db.exec`
        UPDATE alert_history
        SET notification_sent = ${notificationResult.sent > 0}
        WHERE id = ${alertHistory.id}
      `;
    }
  } catch (error) {
    console.error(`Failed to send notifications for alert ${alertHistory.id}:`, error);
  }
}

/**
 * Check if alerts should be automatically resolved
 */
async function checkAlertResolution(rule: AlertRule): Promise<void> {
  const activeAlerts = await db.queryAll<AlertHistory>`
    SELECT * FROM alert_history
    WHERE alert_rule_id = ${rule.id}
    AND status = 'triggered'
  `;

  // Auto-resolve alerts that are no longer triggering
  for (const alert of activeAlerts) {
    const timeSinceTriggered = Date.now() - alert.triggered_at.getTime();
    const autoResolveTime = rule.time_window * 1000 * 2; // Auto-resolve after 2x time window

    if (timeSinceTriggered > autoResolveTime) {
      await db.exec`
        UPDATE alert_history
        SET status = 'resolved',
            resolved_at = NOW(),
            resolution_notes = 'Auto-resolved: condition no longer met'
        WHERE id = ${alert.id}
      `;
    }
  }
}

/**
 * Format alert message for notifications
 */
function formatAlertMessage(rule: AlertRule, evaluationResult: any): string {
  const { value, threshold, context } = evaluationResult;
  
  let message = `Alert rule "${rule.name}" has been triggered.\n\n`;
  
  switch (rule.rule_type) {
    case 'error_spike':
      message += `Error rate spiked by ${value.toFixed(1)}% (threshold: ${threshold}%)\n`;
      if (context) {
        message += `Current errors: ${context.current_count}, Baseline: ${context.baseline_count}\n`;
        message += `Time window: ${context.time_window / 60} minutes`;
      }
      break;

    case 'error_rate':
      message += `Error rate: ${value.toFixed(2)} errors/minute (threshold: ${threshold})\n`;
      if (context) {
        message += `Total errors: ${context.error_count} in ${context.time_window / 60} minutes`;
      }
      break;

    case 'performance':
      message += `Performance metric degraded: ${value.toFixed(0)}ms (threshold: ${threshold}ms)\n`;
      if (context) {
        message += `Metric: ${context.metric_name}, Time window: ${context.time_window / 60} minutes`;
      }
      break;

    case 'custom':
      message += `Custom condition met: ${value} (threshold: ${threshold})\n`;
      break;
  }

  message += `\nSeverity: ${rule.severity.toUpperCase()}`;
  message += `\nTriggered at: ${new Date().toLocaleString()}`;
  
  if (rule.description) {
    message += `\n\nDescription: ${rule.description}`;
  }

  return message;
}

/**
 * Manual alert operations
 */

export const acknowledgeAlert = api<
  { alert_id: number; acknowledged_by: string; notes?: string },
  { success: boolean }
>(
  { expose: true, method: "POST", path: "/api/alerts/history/:alert_id/acknowledge" },
  async (params) => {
    await db.exec`
      UPDATE alert_history
      SET status = 'acknowledged',
          acknowledged_by = ${params.acknowledged_by},
          acknowledged_at = NOW(),
          resolution_notes = COALESCE(resolution_notes, '') || ${params.notes || ''}
      WHERE id = ${params.alert_id}
    `;

    return { success: true };
  }
);

export const resolveAlert = api<
  { alert_id: number; resolved_by: string; notes?: string },
  { success: boolean }
>(
  { expose: true, method: "POST", path: "/api/alerts/history/:alert_id/resolve" },
  async (params) => {
    await db.exec`
      UPDATE alert_history
      SET status = 'resolved',
          resolved_at = NOW(),
          resolution_notes = COALESCE(resolution_notes, '') || ${params.notes || ''}
      WHERE id = ${params.alert_id}
    `;

    return { success: true };
  }
);

export const getAlertHistory = api<
  { 
    project_id: number;
    rule_id?: number;
    status?: 'triggered' | 'resolved' | 'acknowledged';
    limit?: number;
  },
  { alerts: AlertHistory[] }
>(
  { expose: true, method: "GET", path: "/api/alerts/history/by-project/:project_id" },
  async (params) => {
    let whereConditions = "WHERE project_id = $1";
    const queryParams: any[] = [params.project_id];
    let paramIndex = 2;

    if (params.rule_id) {
      whereConditions += ` AND alert_rule_id = $${paramIndex}`;
      queryParams.push(params.rule_id);
      paramIndex++;
    }

    if (params.status) {
      whereConditions += ` AND status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    const limit = Math.min(params.limit || 50, 200);

    const alerts = await db.rawQueryAll<AlertHistory>(
      `SELECT * FROM alert_history 
       ${whereConditions}
       ORDER BY triggered_at DESC 
       LIMIT $${paramIndex}`,
      ...queryParams, limit
    );

    return {
      alerts: alerts.map(alert => ({
        ...alert,
        context_data: typeof alert.context_data === 'string' 
          ? JSON.parse(alert.context_data) 
          : alert.context_data
      }))
    };
  }
);

/**
 * Get alert statistics for dashboard
 */
export const getAlertStats = api<
  { project_id: number; time_range?: '24h' | '7d' | '30d' },
  {
    total_alerts: number;
    active_alerts: number;
    resolved_alerts: number;
    critical_alerts: number;
    by_severity: Record<string, number>;
    recent_trends: Array<{ date: string; count: number }>;
  }
>(
  { expose: true, method: "GET", path: "/api/alerts/stats/by-project/:project_id" },
  async (params) => {
    const timeRange = params.time_range || '24h';
    const endTime = new Date();
    const startTime = new Date();

    switch (timeRange) {
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

    const [totalAlerts, activeAlerts, resolvedAlerts, severityStats, trendData] = await Promise.all([
      db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM alert_history
        WHERE project_id = ${params.project_id}
        AND triggered_at >= ${startTime}
      `,
      db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM alert_history
        WHERE project_id = ${params.project_id}
        AND status = 'triggered'
        AND triggered_at >= ${startTime}
      `,
      db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM alert_history
        WHERE project_id = ${params.project_id}
        AND status = 'resolved'
        AND triggered_at >= ${startTime}
      `,
      db.queryAll<{ severity: string; count: number }>`
        SELECT ar.severity, COUNT(*) as count
        FROM alert_history ah
        JOIN alert_rules ar ON ah.alert_rule_id = ar.id
        WHERE ah.project_id = ${params.project_id}
        AND ah.triggered_at >= ${startTime}
        GROUP BY ar.severity
      `,
      db.queryAll<{ date: string; count: number }>`
        SELECT DATE(triggered_at) as date, COUNT(*) as count
        FROM alert_history
        WHERE project_id = ${params.project_id}
        AND triggered_at >= ${startTime}
        GROUP BY DATE(triggered_at)
        ORDER BY date ASC
      `
    ]);

    const bySeverity: Record<string, number> = {};
    severityStats.forEach(stat => {
      bySeverity[stat.severity] = stat.count;
    });

    const criticalAlerts = bySeverity.critical || 0;

    return {
      total_alerts: totalAlerts?.count || 0,
      active_alerts: activeAlerts?.count || 0,
      resolved_alerts: resolvedAlerts?.count || 0,
      critical_alerts: criticalAlerts,
      by_severity: bySeverity,
      recent_trends: trendData
    };
  }
);