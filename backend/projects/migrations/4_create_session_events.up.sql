CREATE TABLE session_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for event queries
CREATE INDEX idx_session_events_session_id ON session_events(session_id);
CREATE INDEX idx_session_events_timestamp ON session_events(timestamp);
CREATE INDEX idx_session_events_session_timestamp ON session_events(session_id, timestamp);
