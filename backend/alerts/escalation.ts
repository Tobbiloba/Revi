import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { db } from "./db";
import { sendEnhancedNotification } from "./notifications";

export interface EscalationPolicy {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  is_active: boolean;
  escalation_rules: EscalationRule[];
  created_at: Date;
  updated_at: Date;
}

export interface EscalationRule {
  level: number;
  delay_minutes: number;
  notification_channels: Array<{
    type: 'email' | 'slack' | 'webhook' | 'sms' | 'discord';
    config: Record<string, any>;
  }>;
  conditions?: {
    severity?: string[];
    alert_types?: string[];
    error_threshold?: number;
  };
}

export interface EscalationInstance {
  id: number;
  alert_history_id: number;
  escalation_policy_id: number;
  current_level: number;
  status: 'pending' | 'escalating' | 'resolved' | 'max_reached';
  next_escalation_at?: Date;
  escalated_levels: number[];
  created_at: Date;
  updated_at: Date;
}

/**
 * API endpoint for cron job to process escalations
 */
export const processEscalationsEndpoint = api(
  { method: "POST", expose: false, path: "/internal/escalations/process" },
  async (): Promise<void> => {
    try {
      await processEscalations();
    } catch (error) {
      console.error("Escalation processing error:", error);
    }
  }
);

/**
 * Background job to process escalations
 */
export const escalationProcessor = new CronJob("escalation-processor", {
  title: "Escalation Processor",
  every: "1m",
  endpoint: processEscalationsEndpoint,
});

/**
 * Create escalation for a triggered alert
 */
export async function createEscalation(
  alertHistoryId: number,
  escalationPolicyId: number
): Promise<void> {
  // Check if escalation already exists
  const existing = await db.queryRow<EscalationInstance>`
    SELECT * FROM escalation_instances
    WHERE alert_history_id = ${alertHistoryId}
    AND status IN ('pending', 'escalating')
  `;

  if (existing) return;

  const policy = await db.queryRow<EscalationPolicy>`
    SELECT * FROM escalation_policies
    WHERE id = ${escalationPolicyId} AND is_active = true
  `;

  if (!policy) {
    console.warn(`Escalation policy ${escalationPolicyId} not found or inactive`);
    return;
  }

  // Get the first escalation rule
  const firstRule = policy.escalation_rules.sort((a, b) => a.level - b.level)[0];
  if (!firstRule) return;

  const nextEscalationAt = new Date();
  nextEscalationAt.setMinutes(nextEscalationAt.getMinutes() + firstRule.delay_minutes);

  await db.exec`
    INSERT INTO escalation_instances (
      alert_history_id, escalation_policy_id, current_level,
      status, next_escalation_at
    ) VALUES (
      ${alertHistoryId}, ${escalationPolicyId}, 0,
      'pending', ${nextEscalationAt}
    )
  `;
}

/**
 * Process pending escalations
 */
async function processEscalations(): Promise<void> {
  const pendingEscalations = await db.queryAll<EscalationInstance & {
    alert_history: any;
    policy: EscalationPolicy;
  }>`
    SELECT 
      ei.*,
      ah.project_id, ah.alert_rule_id, ah.trigger_value, 
      ah.context_data, ah.status as alert_status,
      ep.escalation_rules
    FROM escalation_instances ei
    JOIN alert_history ah ON ei.alert_history_id = ah.id
    JOIN escalation_policies ep ON ei.escalation_policy_id = ep.id
    WHERE ei.status IN ('pending', 'escalating')
    AND ei.next_escalation_at <= NOW()
    AND ah.status = 'triggered'
  `;

  for (const escalation of pendingEscalations) {
    try {
      await processEscalation(escalation);
    } catch (error) {
      console.error(`Error processing escalation ${escalation.id}:`, error);
    }
  }
}

/**
 * Process a single escalation instance
 */
async function processEscalation(escalation: any): Promise<void> {
  const rules = escalation.escalation_rules || [];
  const nextLevel = escalation.current_level + 1;
  const nextRule = rules.find((rule: EscalationRule) => rule.level === nextLevel);

  if (!nextRule) {
    // No more escalation levels, mark as max reached
    await db.exec`
      UPDATE escalation_instances
      SET status = 'max_reached', updated_at = NOW()
      WHERE id = ${escalation.id}
    `;
    return;
  }

  // Check if rule conditions match
  if (!doesRuleMatch(nextRule, escalation)) {
    // Skip this level and move to next
    const followingRule = rules.find((rule: EscalationRule) => rule.level === nextLevel + 1);
    if (followingRule) {
      const nextEscalationAt = new Date();
      nextEscalationAt.setMinutes(nextEscalationAt.getMinutes() + followingRule.delay_minutes);
      
      await db.exec`
        UPDATE escalation_instances
        SET current_level = ${nextLevel}, next_escalation_at = ${nextEscalationAt},
            status = 'escalating', updated_at = NOW()
        WHERE id = ${escalation.id}
      `;
    } else {
      await db.exec`
        UPDATE escalation_instances
        SET status = 'max_reached', updated_at = NOW()
        WHERE id = ${escalation.id}
      `;
    }
    return;
  }

  // Send notifications for this level
  let notificationsSent = 0;
  for (const channel of nextRule.notification_channels) {
    try {
      await sendEscalationNotification(escalation, nextLevel, channel);
      notificationsSent++;
    } catch (error) {
      console.error(`Failed to send escalation notification:`, error);
    }
  }

  // Update escalation instance
  const escalatedLevels = [...escalation.escalated_levels, nextLevel];
  const followingRule = rules.find((rule: EscalationRule) => rule.level === nextLevel + 1);
  
  if (followingRule) {
    const nextEscalationAt = new Date();
    nextEscalationAt.setMinutes(nextEscalationAt.getMinutes() + followingRule.delay_minutes);
    
    await db.exec`
      UPDATE escalation_instances
      SET current_level = ${nextLevel}, 
          escalated_levels = ${JSON.stringify(escalatedLevels)},
          next_escalation_at = ${nextEscalationAt},
          status = 'escalating',
          updated_at = NOW()
      WHERE id = ${escalation.id}
    `;
  } else {
    await db.exec`
      UPDATE escalation_instances
      SET current_level = ${nextLevel},
          escalated_levels = ${JSON.stringify(escalatedLevels)},
          status = 'max_reached',
          updated_at = NOW()
      WHERE id = ${escalation.id}
    `;
  }

  console.log(`Escalated alert ${escalation.alert_history_id} to level ${nextLevel}, sent ${notificationsSent} notifications`);
}

/**
 * Check if escalation rule conditions match the current alert
 */
function doesRuleMatch(rule: EscalationRule, escalation: any): boolean {
  if (!rule.conditions) return true;

  // Check severity condition
  if (rule.conditions.severity && escalation.context_data?.severity) {
    if (!rule.conditions.severity.includes(escalation.context_data.severity)) {
      return false;
    }
  }

  // Check alert type condition
  if (rule.conditions.alert_types && escalation.context_data?.alert_type) {
    if (!rule.conditions.alert_types.includes(escalation.context_data.alert_type)) {
      return false;
    }
  }

  // Check error threshold condition
  if (rule.conditions.error_threshold && escalation.trigger_value) {
    if (escalation.trigger_value < rule.conditions.error_threshold) {
      return false;
    }
  }

  return true;
}

/**
 * Send escalation notification
 */
async function sendEscalationNotification(
  escalation: any,
  level: number,
  channel: { type: string; config: Record<string, any> }
): Promise<void> {
  const message = formatEscalationMessage(escalation, level);
  
  await sendEnhancedNotification({
    type: channel.type as any,
    config: channel.config,
    subject: `🚨 ESCALATED: Alert Level ${level}`,
    message,
    metadata: {
      escalation_id: escalation.id,
      alert_history_id: escalation.alert_history_id,
      escalation_level: level,
      project_id: escalation.project_id,
      severity: 'critical'
    }
  });
}

/**
 * Format escalation message
 */
function formatEscalationMessage(escalation: any, level: number): string {
  const context = escalation.context_data || {};
  
  return `
🚨 **ALERT ESCALATED TO LEVEL ${level}**

**Project:** ${escalation.project_id}
**Alert Rule:** ${escalation.alert_rule_id}
**Severity:** ${context.severity || 'Unknown'}
**Trigger Value:** ${escalation.trigger_value}

**Alert Details:**
${context.description || 'No description available'}

**Time:** ${new Date().toISOString()}
**Escalation ID:** ${escalation.id}

This alert has been escalated due to no acknowledgment or resolution.
Please take immediate action to resolve this issue.
`.trim();
}

/**
 * Resolve escalation (when alert is resolved or acknowledged)
 */
export async function resolveEscalation(alertHistoryId: number): Promise<void> {
  await db.exec`
    UPDATE escalation_instances
    SET status = 'resolved', updated_at = NOW()
    WHERE alert_history_id = ${alertHistoryId}
    AND status IN ('pending', 'escalating')
  `;
}

/**
 * API endpoints for escalation management
 */

export const createEscalationPolicy = api<{
  project_id: number;
  name: string;
  description?: string;
  escalation_rules: EscalationRule[];
}, { policy: EscalationPolicy }>(
  { expose: true, method: "POST", path: "/api/alerts/escalation-policies" },
  async (params) => {
    const policy = await db.queryRow<EscalationPolicy>`
      INSERT INTO escalation_policies (
        project_id, name, description, escalation_rules, is_active
      ) VALUES (
        ${params.project_id}, ${params.name}, ${params.description},
        ${JSON.stringify(params.escalation_rules)}, true
      )
      RETURNING *
    `;

    return { policy: policy! };
  }
);

export const getEscalationPolicies = api<{
  project_id: number;
}, { policies: EscalationPolicy[] }>(
  { expose: true, method: "GET", path: "/api/alerts/escalation-policies/by-project/:project_id" },
  async (params) => {
    const policies = await db.queryAll<EscalationPolicy>`
      SELECT * FROM escalation_policies
      WHERE project_id = ${params.project_id}
      ORDER BY created_at DESC
    `;

    return { policies };
  }
);

export const updateEscalationPolicy = api<{
  policy_id: number;
  name?: string;
  description?: string;
  escalation_rules?: EscalationRule[];
  is_active?: boolean;
}, { success: boolean }>(
  { expose: true, method: "PATCH", path: "/api/alerts/escalation-policies/:policy_id" },
  async (params) => {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(params.name);
    }

    if (params.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(params.description);
    }

    if (params.escalation_rules !== undefined) {
      updates.push(`escalation_rules = $${paramIndex++}`);
      values.push(JSON.stringify(params.escalation_rules));
    }

    if (params.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(params.is_active);
    }

    if (updates.length === 0) {
      return { success: false };
    }

    updates.push(`updated_at = NOW()`);

    await db.rawExec(
      `UPDATE escalation_policies SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      ...values, params.policy_id
    );

    return { success: true };
  }
);

export const getEscalationHistory = api<{
  project_id: number;
  limit?: number;
  status?: string;
}, {
  escalations: Array<EscalationInstance & {
    alert_context: Record<string, any>;
    policy_name: string;
  }>;
}>(
  { expose: true, method: "GET", path: "/api/alerts/escalation-history/by-project/:project_id" },
  async (params) => {
    let whereCondition = "WHERE ah.project_id = $1";
    const queryParams: any[] = [params.project_id];
    let paramIndex = 2;

    if (params.status) {
      whereCondition += ` AND ei.status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    const limit = Math.min(params.limit || 50, 100);

    const escalations = await db.rawQueryAll<EscalationInstance & {
      alert_context: Record<string, any>;
      policy_name: string;
    }>(
      `SELECT 
         ei.*,
         ah.context_data as alert_context,
         ep.name as policy_name
       FROM escalation_instances ei
       JOIN alert_history ah ON ei.alert_history_id = ah.id
       JOIN escalation_policies ep ON ei.escalation_policy_id = ep.id
       ${whereCondition}
       ORDER BY ei.created_at DESC
       LIMIT $${paramIndex}`,
      ...queryParams, limit
    );

    return { escalations };
  }
);

/**
 * Manual escalation trigger (for testing or emergency situations)
 */
export const triggerManualEscalation = api<{
  alert_history_id: number;
  escalation_policy_id: number;
  skip_to_level?: number;
}, { success: boolean }>(
  { expose: true, method: "POST", path: "/api/alerts/trigger-escalation" },
  async (params) => {
    // Create or update escalation instance
    const existing = await db.queryRow<EscalationInstance>`
      SELECT * FROM escalation_instances
      WHERE alert_history_id = ${params.alert_history_id}
    `;

    if (existing) {
      // Update existing escalation to trigger immediately
      const targetLevel = params.skip_to_level || (existing.current_level + 1);
      await db.exec`
        UPDATE escalation_instances
        SET current_level = ${targetLevel - 1},
            next_escalation_at = NOW(),
            status = 'escalating',
            updated_at = NOW()
        WHERE id = ${existing.id}
      `;
    } else {
      // Create new escalation to trigger immediately
      const targetLevel = params.skip_to_level || 1;
      await db.exec`
        INSERT INTO escalation_instances (
          alert_history_id, escalation_policy_id, current_level,
          status, next_escalation_at
        ) VALUES (
          ${params.alert_history_id}, ${params.escalation_policy_id}, 
          ${targetLevel - 1}, 'escalating', NOW()
        )
      `;
    }

    return { success: true };
  }
);