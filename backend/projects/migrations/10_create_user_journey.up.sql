-- User Journey Events table for detailed user path tracking
CREATE TABLE user_journey_events (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT, -- Optional user ID
  user_fingerprint TEXT NOT NULL, -- Anonymous user tracking
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'error', 'click', 'form_submit', 'api_call', 'exit')),
  url TEXT NOT NULL,
  referrer TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER, -- Time spent on page or duration of action
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for user journey queries
CREATE INDEX idx_user_journey_project_time ON user_journey_events(project_id, timestamp);
CREATE INDEX idx_user_journey_user ON user_journey_events(user_id);
CREATE INDEX idx_user_journey_fingerprint ON user_journey_events(user_fingerprint);
CREATE INDEX idx_user_journey_session ON user_journey_events(session_id);
CREATE INDEX idx_user_journey_event_type ON user_journey_events(event_type);
CREATE INDEX idx_user_journey_url ON user_journey_events(url);

-- Conversion Events table for funnel analysis
CREATE TABLE conversion_events (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  funnel_name TEXT NOT NULL,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  user_fingerprint TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for conversion tracking
CREATE INDEX idx_conversion_project_funnel ON conversion_events(project_id, funnel_name);
CREATE INDEX idx_conversion_user ON conversion_events(user_fingerprint);
CREATE INDEX idx_conversion_time ON conversion_events(timestamp);
CREATE UNIQUE INDEX idx_conversion_unique ON conversion_events(project_id, funnel_name, step_name, user_fingerprint, session_id);

-- Device Analytics table for detailed device tracking
CREATE TABLE device_analytics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_type TEXT, -- desktop, mobile, tablet
  browser_name TEXT,
  browser_version TEXT,
  os_name TEXT,
  os_version TEXT,
  screen_resolution TEXT,
  color_depth INTEGER,
  timezone TEXT,
  language TEXT,
  platform TEXT,
  user_agent TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_sessions BIGINT DEFAULT 1,
  total_page_views BIGINT DEFAULT 0,
  total_errors BIGINT DEFAULT 0,
  avg_session_duration DECIMAL(10,2), -- in seconds
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for device analytics
CREATE INDEX idx_device_analytics_project ON device_analytics(project_id);
CREATE INDEX idx_device_analytics_type ON device_analytics(device_type);
CREATE INDEX idx_device_analytics_browser ON device_analytics(browser_name);
CREATE INDEX idx_device_analytics_os ON device_analytics(os_name);
CREATE UNIQUE INDEX idx_device_analytics_unique ON device_analytics(project_id, device_fingerprint);