-- Performance Optimization: Composite Indexes for Query Performance
-- Simplified indexes compatible with Encore migrations

-- OPTIMIZATION 1: Stats query optimization
-- Covers the main stats calculation query (project + time range + status)
CREATE INDEX idx_errors_stats_optimized 
    ON errors(project_id, timestamp DESC, status);

-- OPTIMIZATION 2: Session analytics optimization  
-- Covers session counting and user analytics queries
CREATE INDEX idx_sessions_analytics_optimized
    ON sessions(project_id, started_at DESC, user_id);

-- OPTIMIZATION 3: Error grouping performance
-- Speeds up error grouping and fingerprinting queries
CREATE INDEX idx_errors_grouping_optimized
    ON errors(project_id, fingerprint, timestamp DESC);

-- OPTIMIZATION 4: Browser/OS analytics optimization
-- Speeds up user agent parsing and analytics
CREATE INDEX idx_errors_user_agent_analytics
    ON errors(project_id, timestamp DESC, user_agent);

-- OPTIMIZATION 5: URL-based error analysis
-- Optimizes top error pages queries
CREATE INDEX idx_errors_url_analysis
    ON errors(project_id, url, timestamp DESC);

-- OPTIMIZATION 6: Session events timeline optimization
-- Speeds up session replay queries
CREATE INDEX idx_session_events_timeline
    ON session_events(session_id, timestamp ASC, event_type);

-- OPTIMIZATION 7: Network events performance
-- Optimizes network monitoring queries
CREATE INDEX idx_network_events_performance
    ON network_events(session_id, timestamp ASC, status_code);

-- OPTIMIZATION 8: Simplified metadata support
-- Note: JSON operator indexes require custom functions - skipping for compatibility

-- OPTIMIZATION 10: Error trend analysis optimization
-- Optimized for time-series queries and dashboards (simplified)
CREATE INDEX idx_errors_trend_analysis
    ON errors(project_id, timestamp DESC);

-- OPTIMIZATION 11: Alerts and monitoring optimization
CREATE INDEX idx_errors_alerts_monitoring
    ON errors(project_id, timestamp DESC, message);

-- OPTIMIZATION 12: Performance regression detection
CREATE INDEX idx_performance_metrics_regression
    ON performance_metrics(project_id, metric_name, timestamp DESC, metric_value);

-- Update table statistics after creating indexes
ANALYZE errors;
ANALYZE sessions;
ANALYZE session_events;
ANALYZE network_events;
ANALYZE performance_metrics;