-- User Analytics table for user-centric error tracking
CREATE TABLE user_analytics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Can be email, uuid, or anonymous ID
  user_fingerprint TEXT, -- Browser fingerprint for anonymous users
  email TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_sessions BIGINT DEFAULT 0,
  total_errors BIGINT DEFAULT 0,
  total_page_views BIGINT DEFAULT 0,
  avg_session_duration DECIMAL(10,2), -- in seconds
  browser_name TEXT,
  browser_version TEXT,
  os_name TEXT,
  os_version TEXT,
  device_type TEXT, -- desktop, mobile, tablet
  country_code TEXT,
  city TEXT,
  timezone TEXT,
  language TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_analytics_project_id ON user_analytics(project_id);
CREATE INDEX idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX idx_user_analytics_user_fingerprint ON user_analytics(user_fingerprint);
CREATE INDEX idx_user_analytics_total_errors ON user_analytics(total_errors);
CREATE INDEX idx_user_analytics_last_seen ON user_analytics(last_seen);
CREATE INDEX idx_user_analytics_country_code ON user_analytics(country_code);
CREATE UNIQUE INDEX idx_user_analytics_project_user ON user_analytics(project_id, user_id);

-- Error Statistics table for trend analysis
CREATE TABLE error_statistics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  error_group_id BIGINT REFERENCES error_groups(id) ON DELETE CASCADE,
  time_bucket TIMESTAMPTZ NOT NULL, -- Hourly buckets for aggregation
  error_count BIGINT DEFAULT 0,
  unique_users BIGINT DEFAULT 0,
  unique_sessions BIGINT DEFAULT 0,
  avg_response_time DECIMAL(10,2), -- in milliseconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for time series queries
CREATE INDEX idx_error_statistics_project_time ON error_statistics(project_id, time_bucket);
CREATE INDEX idx_error_statistics_group_time ON error_statistics(error_group_id, time_bucket);
CREATE INDEX idx_error_statistics_time_bucket ON error_statistics(time_bucket);
CREATE UNIQUE INDEX idx_error_statistics_unique ON error_statistics(project_id, error_group_id, time_bucket);

-- Geographic Analytics table
CREATE TABLE geo_analytics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  country_name TEXT,
  city TEXT,
  region TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  error_count BIGINT DEFAULT 0,
  unique_users BIGINT DEFAULT 0,
  avg_load_time DECIMAL(10,2), -- in milliseconds
  time_bucket TIMESTAMPTZ NOT NULL, -- Daily buckets
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_geo_analytics_project_time ON geo_analytics(project_id, time_bucket);
CREATE INDEX idx_geo_analytics_country ON geo_analytics(country_code);
CREATE UNIQUE INDEX idx_geo_analytics_unique ON geo_analytics(project_id, country_code, city, time_bucket);