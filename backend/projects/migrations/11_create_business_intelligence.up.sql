-- Custom Metrics table for user-defined KPIs
CREATE TABLE custom_metrics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('count', 'average', 'sum', 'percentage', 'rate')),
  query_config JSONB NOT NULL, -- Configuration for metric calculation
  display_config JSONB DEFAULT '{}'::jsonb, -- UI display configuration
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custom Dashboards table
CREATE TABLE custom_dashboards (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  layout_config JSONB DEFAULT '{}'::jsonb, -- Dashboard layout configuration
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard Widgets table
CREATE TABLE dashboard_widgets (
  id BIGSERIAL PRIMARY KEY,
  dashboard_id BIGINT NOT NULL REFERENCES custom_dashboards(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL CHECK (widget_type IN ('chart', 'metric', 'table', 'heatmap')),
  title TEXT NOT NULL,
  position JSONB NOT NULL, -- {x, y, w, h} for grid positioning
  configuration JSONB NOT NULL, -- Widget-specific configuration
  data_source TEXT NOT NULL CHECK (data_source IN ('errors', 'sessions', 'performance', 'custom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data Export Jobs table for tracking exports
CREATE TABLE data_exports (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN ('csv', 'json', 'excel')),
  data_types TEXT[] NOT NULL, -- Array of data types exported
  time_range TEXT NOT NULL,
  include_pii BOOLEAN DEFAULT false,
  file_url TEXT,
  file_size BIGINT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Saved Queries table for advanced search
CREATE TABLE saved_queries (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  query_text TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT false,
  usage_count BIGINT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Business KPIs table for tracking business metrics
CREATE TABLE business_kpis (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kpi_name TEXT NOT NULL,
  kpi_value DECIMAL(15,4) NOT NULL,
  kpi_unit TEXT, -- 'percentage', 'currency', 'count', etc.
  calculation_method TEXT NOT NULL, -- How the KPI is calculated
  time_bucket TIMESTAMPTZ NOT NULL, -- Time bucket for this measurement
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A/B Test Results table for experiment tracking
CREATE TABLE ab_test_results (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  variant TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  sample_size BIGINT NOT NULL,
  confidence_level DECIMAL(5,4), -- e.g., 0.95 for 95% confidence
  time_bucket TIMESTAMPTZ NOT NULL,
  test_start_date TIMESTAMPTZ,
  test_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_custom_metrics_project ON custom_metrics(project_id);
CREATE INDEX idx_custom_dashboards_project ON custom_dashboards(project_id);
CREATE INDEX idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX idx_data_exports_project ON data_exports(project_id);
CREATE INDEX idx_data_exports_status ON data_exports(status);
CREATE INDEX idx_saved_queries_project ON saved_queries(project_id);
CREATE INDEX idx_business_kpis_project_time ON business_kpis(project_id, time_bucket);
CREATE INDEX idx_ab_test_results_project_test ON ab_test_results(project_id, test_name);

-- User Activity table for tracking dashboard usage
CREATE TABLE user_activity (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('dashboard_view', 'query_run', 'export_create', 'alert_acknowledge')),
  resource_id BIGINT, -- ID of the resource (dashboard, query, etc.)
  resource_type TEXT, -- Type of resource
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_activity_project_user ON user_activity(project_id, user_id);
CREATE INDEX idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX idx_user_activity_time ON user_activity(created_at);