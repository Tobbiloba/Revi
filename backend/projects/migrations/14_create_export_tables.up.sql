-- Data Export tables for business intelligence exports

CREATE TABLE IF NOT EXISTS dashboard_exports (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN ('csv', 'json', 'pdf', 'excel')),
  data_source TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  fields TEXT[],
  file_path TEXT,
  file_size BIGINT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_schedules (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  export_config JSONB NOT NULL,
  schedule_cron TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additional tables for comprehensive BI support
CREATE TABLE IF NOT EXISTS error_statistics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  error_group_id BIGINT REFERENCES error_groups(id) ON DELETE CASCADE,
  time_bucket TIMESTAMPTZ NOT NULL,
  error_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  avg_response_time DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS error_impact_analysis (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  error_group_id BIGINT REFERENCES error_groups(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  total_affected_users INTEGER DEFAULT 0,
  user_churn_rate DECIMAL(5,4) DEFAULT 0,
  estimated_revenue_loss DECIMAL(12,2) DEFAULT 0,
  error_resolution_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_exports_project_id ON dashboard_exports(project_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_exports_status ON dashboard_exports(status);
CREATE INDEX IF NOT EXISTS idx_dashboard_exports_expires_at ON dashboard_exports(expires_at);

CREATE INDEX IF NOT EXISTS idx_export_schedules_project_id ON export_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_export_schedules_next_run ON export_schedules(next_run_at);

CREATE INDEX IF NOT EXISTS idx_error_statistics_project_time ON error_statistics(project_id, time_bucket);
CREATE INDEX IF NOT EXISTS idx_error_statistics_group ON error_statistics(error_group_id);

CREATE INDEX IF NOT EXISTS idx_error_impact_project_date ON error_impact_analysis(project_id, analysis_date);
CREATE INDEX IF NOT EXISTS idx_error_impact_group ON error_impact_analysis(error_group_id);