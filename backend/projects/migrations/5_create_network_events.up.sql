CREATE TABLE network_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  response_time INTEGER,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_data JSONB DEFAULT '{}'::jsonb,
  response_data JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for network event queries
CREATE INDEX idx_network_events_session_id ON network_events(session_id);
CREATE INDEX idx_network_events_timestamp ON network_events(timestamp);
CREATE INDEX idx_network_events_session_timestamp ON network_events(session_id, timestamp);
