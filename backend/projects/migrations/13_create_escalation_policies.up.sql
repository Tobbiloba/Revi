-- Escalation Policies table
CREATE TABLE escalation_policies (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  escalation_rules JSONB NOT NULL DEFAULT '[]', -- Array of escalation rules
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Escalation Instances table - tracks active escalations
CREATE TABLE escalation_instances (
  id BIGSERIAL PRIMARY KEY,
  alert_history_id BIGINT NOT NULL REFERENCES alert_history(id) ON DELETE CASCADE,
  escalation_policy_id BIGINT NOT NULL REFERENCES escalation_policies(id) ON DELETE CASCADE,
  current_level INTEGER DEFAULT 0, -- Current escalation level (0 = initial)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'escalating', 'resolved', 'max_reached')),
  next_escalation_at TIMESTAMPTZ, -- When to trigger next escalation level
  escalated_levels INTEGER[] DEFAULT '{}', -- Array of levels that have been escalated
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification Logs table - track all sent notifications
CREATE TABLE notification_logs (
  id BIGSERIAL PRIMARY KEY,
  escalation_instance_id BIGINT REFERENCES escalation_instances(id) ON DELETE CASCADE,
  alert_history_id BIGINT REFERENCES alert_history(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'email', 'slack', 'webhook', 'sms', 'discord'
  notification_config JSONB NOT NULL, -- Channel configuration
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending', 'delivered')),
  error_message TEXT, -- If failed, store error details
  response_data JSONB, -- Store response from notification service
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ -- When notification was confirmed delivered
);

-- Add escalation policy reference to alert rules
ALTER TABLE alert_rules 
ADD COLUMN escalation_policy_id BIGINT REFERENCES escalation_policies(id);

-- Indexes for performance
CREATE INDEX idx_escalation_policies_project ON escalation_policies(project_id);
CREATE INDEX idx_escalation_policies_active ON escalation_policies(is_active);

CREATE INDEX idx_escalation_instances_alert ON escalation_instances(alert_history_id);
CREATE INDEX idx_escalation_instances_policy ON escalation_instances(escalation_policy_id);
CREATE INDEX idx_escalation_instances_status ON escalation_instances(status);
CREATE INDEX idx_escalation_instances_next_escalation ON escalation_instances(next_escalation_at) WHERE status IN ('pending', 'escalating');

CREATE INDEX idx_notification_logs_escalation ON notification_logs(escalation_instance_id);
CREATE INDEX idx_notification_logs_alert ON notification_logs(alert_history_id);
CREATE INDEX idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_sent_at ON notification_logs(sent_at);

-- Create default escalation policy for existing projects
INSERT INTO escalation_policies (project_id, name, description, escalation_rules)
SELECT 
  id as project_id,
  'Default Escalation Policy' as name,
  'Auto-generated default escalation policy' as description,
  '[
    {
      "level": 1,
      "delay_minutes": 5,
      "notification_channels": [
        {
          "type": "email",
          "config": {
            "to": "admin@example.com",
            "template": "alert_notification"
          }
        }
      ]
    },
    {
      "level": 2,
      "delay_minutes": 15,
      "notification_channels": [
        {
          "type": "email",
          "config": {
            "to": "admin@example.com",
            "template": "alert_escalation",
            "priority": "high"
          }
        }
      ]
    },
    {
      "level": 3,
      "delay_minutes": 30,
      "notification_channels": [
        {
          "type": "email",
          "config": {
            "to": "admin@example.com",
            "template": "alert_critical",
            "priority": "urgent"
          }
        }
      ]
    }
  ]'::jsonb as escalation_rules
FROM projects
WHERE NOT EXISTS (
  SELECT 1 FROM escalation_policies WHERE project_id = projects.id
);