-- Error Groups table for intelligent error clustering
CREATE TABLE error_groups (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL, -- Unique hash for this error pattern
  pattern_hash TEXT NOT NULL, -- Additional hash for similar patterns
  title TEXT NOT NULL, -- Human readable title for the group
  message_template TEXT NOT NULL, -- Generalized error message
  stack_pattern TEXT, -- Normalized stack trace pattern
  url_pattern TEXT, -- URL pattern for this group
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_occurrences BIGINT DEFAULT 1,
  unique_users BIGINT DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored', 'investigating')),
  assigned_to TEXT, -- User ID who is assigned to fix this
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_error_groups_project_id ON error_groups(project_id);
CREATE INDEX idx_error_groups_fingerprint ON error_groups(fingerprint);
CREATE INDEX idx_error_groups_pattern_hash ON error_groups(pattern_hash);
CREATE INDEX idx_error_groups_status ON error_groups(status);
CREATE INDEX idx_error_groups_priority ON error_groups(priority);
CREATE INDEX idx_error_groups_last_seen ON error_groups(last_seen);
CREATE UNIQUE INDEX idx_error_groups_project_fingerprint ON error_groups(project_id, fingerprint);

-- Add error group reference to errors table
ALTER TABLE errors ADD COLUMN error_group_id BIGINT REFERENCES error_groups(id) ON DELETE SET NULL;
ALTER TABLE errors ADD COLUMN fingerprint TEXT;
CREATE INDEX idx_errors_error_group_id ON errors(error_group_id);
CREATE INDEX idx_errors_fingerprint ON errors(fingerprint);