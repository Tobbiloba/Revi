CREATE TABLE errors (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  stack_trace TEXT,
  url TEXT,
  user_agent TEXT,
  session_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for common queries
CREATE INDEX idx_errors_project_id ON errors(project_id);
CREATE INDEX idx_errors_session_id ON errors(session_id);
CREATE INDEX idx_errors_timestamp ON errors(timestamp);
CREATE INDEX idx_errors_project_timestamp ON errors(project_id, timestamp);
