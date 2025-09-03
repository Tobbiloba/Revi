-- Alert Rules table for smart alerting system
CREATE TABLE alert_rules (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('error_spike', 'error_rate', 'performance', 'custom')),
  conditions JSONB NOT NULL, -- JSON object with rule conditions
  threshold_value DECIMAL(10,2), -- Numeric threshold
  threshold_operator TEXT CHECK (threshold_operator IN ('gt', 'gte', 'lt', 'lte', 'eq')),
  time_window INTEGER DEFAULT 300, -- Time window in seconds
  cooldown_period INTEGER DEFAULT 3600, -- Cooldown in seconds
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  channels JSONB DEFAULT '[]'::jsonb, -- Array of notification channels
  created_by TEXT, -- User ID who created the rule
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert History table
CREATE TABLE alert_history (
  id BIGSERIAL PRIMARY KEY,
  alert_rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'triggered' CHECK (status IN ('triggered', 'resolved', 'acknowledged')),
  trigger_value DECIMAL(10,2), -- The actual value that triggered the alert
  context_data JSONB DEFAULT '{}'::jsonb, -- Additional context about the alert
  notification_sent BOOLEAN DEFAULT false,
  acknowledged_by TEXT, -- User ID who acknowledged
  acknowledged_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification Channels table
CREATE TABLE notification_channels (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'slack', 'webhook', 'sms', 'discord')),
  configuration JSONB NOT NULL, -- Channel-specific config (webhook URL, Slack channel, etc.)
  is_active BOOLEAN DEFAULT true,
  test_successful BOOLEAN DEFAULT false,
  last_test_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_alert_rules_project_id ON alert_rules(project_id);
CREATE INDEX idx_alert_rules_active ON alert_rules(is_active);
CREATE INDEX idx_alert_history_rule_id ON alert_history(alert_rule_id);
CREATE INDEX idx_alert_history_status ON alert_history(status);
CREATE INDEX idx_alert_history_triggered_at ON alert_history(triggered_at);
CREATE INDEX idx_notification_channels_project ON notification_channels(project_id);

-- Performance Metrics table for regression detection
CREATE TABLE performance_metrics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT,
  url TEXT,
  metric_name TEXT NOT NULL, -- 'lcp', 'fid', 'cls', 'fcp', 'ttfb', etc.
  metric_value DECIMAL(10,2) NOT NULL,
  rating TEXT CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  user_agent TEXT,
  connection_type TEXT, -- '4g', 'wifi', etc.
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance queries
CREATE INDEX idx_performance_metrics_project_time ON performance_metrics(project_id, timestamp);
CREATE INDEX idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX idx_performance_metrics_url ON performance_metrics(url);
CREATE INDEX idx_performance_metrics_rating ON performance_metrics(rating);