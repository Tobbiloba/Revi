-- Performance Baselines table for regression detection
CREATE TABLE performance_baselines (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL, -- 'lcp', 'fid', 'cls', etc.
  url_pattern TEXT, -- Optional URL pattern for page-specific baselines
  baseline_value DECIMAL(10,2) NOT NULL, -- Average baseline value
  baseline_p95 DECIMAL(10,2) NOT NULL, -- 95th percentile baseline
  baseline_p99 DECIMAL(10,2) NOT NULL, -- 99th percentile baseline
  sample_count BIGINT NOT NULL, -- Number of samples used for baseline
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Regressions table
CREATE TABLE performance_regressions (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  url_pattern TEXT,
  baseline_value DECIMAL(10,2) NOT NULL,
  current_value DECIMAL(10,2) NOT NULL,
  regression_percentage DECIMAL(5,2) NOT NULL, -- Percentage increase
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_positive')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Error Impact Analysis table
CREATE TABLE error_impact_analysis (
  id BIGSERIAL PRIMARY KEY,
  error_group_id BIGINT NOT NULL REFERENCES error_groups(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  
  -- User Impact Metrics
  total_affected_users BIGINT DEFAULT 0,
  new_affected_users BIGINT DEFAULT 0,
  returning_affected_users BIGINT DEFAULT 0,
  user_churn_rate DECIMAL(5,4), -- Percentage of users who stopped using after error
  
  -- Session Impact Metrics  
  total_affected_sessions BIGINT DEFAULT 0,
  avg_session_duration_before DECIMAL(10,2), -- in seconds
  avg_session_duration_after DECIMAL(10,2), -- in seconds
  session_abandonment_rate DECIMAL(5,4), -- Percentage of sessions abandoned after error
  
  -- Business Impact Metrics
  estimated_revenue_loss DECIMAL(15,2), -- If revenue tracking is available
  conversion_impact DECIMAL(5,4), -- Impact on conversion rates
  page_view_drop DECIMAL(5,4), -- Drop in page views after error
  
  -- Technical Impact Metrics
  avg_error_frequency DECIMAL(10,2), -- Errors per session
  peak_error_rate DECIMAL(10,2), -- Maximum errors per minute
  error_resolution_time BIGINT, -- Time to fix in minutes
  
  -- Comparative Analysis
  period_over_period_change DECIMAL(5,4), -- Week over week change
  baseline_comparison DECIMAL(5,4), -- Comparison to normal baseline
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Error Timeline for impact analysis
CREATE TABLE user_error_timeline (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_fingerprint TEXT NOT NULL,
  error_group_id BIGINT NOT NULL REFERENCES error_groups(id) ON DELETE CASCADE,
  first_error_at TIMESTAMPTZ NOT NULL,
  last_error_at TIMESTAMPTZ NOT NULL,
  total_errors BIGINT DEFAULT 1,
  sessions_with_errors BIGINT DEFAULT 1,
  user_churned BOOLEAN DEFAULT false,
  churn_detected_at TIMESTAMPTZ,
  revenue_before_error DECIMAL(15,2), -- If available
  revenue_after_error DECIMAL(15,2), -- If available
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_performance_baselines_unique ON performance_baselines(project_id, metric_name, COALESCE(url_pattern, ''));
CREATE INDEX idx_performance_baselines_project ON performance_baselines(project_id);
CREATE INDEX idx_performance_baselines_updated ON performance_baselines(updated_at);

CREATE INDEX idx_performance_regressions_project ON performance_regressions(project_id);
CREATE INDEX idx_performance_regressions_status ON performance_regressions(status);
CREATE INDEX idx_performance_regressions_severity ON performance_regressions(severity);
CREATE INDEX idx_performance_regressions_detected ON performance_regressions(detected_at);

CREATE INDEX idx_error_impact_analysis_group ON error_impact_analysis(error_group_id);
CREATE INDEX idx_error_impact_analysis_project_date ON error_impact_analysis(project_id, analysis_date);

CREATE INDEX idx_user_error_timeline_project ON user_error_timeline(project_id);
CREATE INDEX idx_user_error_timeline_user ON user_error_timeline(user_fingerprint);
CREATE INDEX idx_user_error_timeline_group ON user_error_timeline(error_group_id);
CREATE UNIQUE INDEX idx_user_error_timeline_unique ON user_error_timeline(project_id, user_fingerprint, error_group_id);