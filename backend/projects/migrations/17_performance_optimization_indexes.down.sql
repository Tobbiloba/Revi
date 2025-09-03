-- Rollback performance optimization indexes

DROP INDEX IF EXISTS idx_performance_metrics_regression;
DROP INDEX IF EXISTS idx_errors_alerts_monitoring;
DROP INDEX IF EXISTS idx_errors_trend_analysis;
DROP INDEX IF EXISTS idx_network_events_performance;
DROP INDEX IF EXISTS idx_session_events_timeline;
DROP INDEX IF EXISTS idx_errors_url_analysis;
DROP INDEX IF EXISTS idx_errors_user_agent_analytics;
DROP INDEX IF EXISTS idx_errors_grouping_optimized;
DROP INDEX IF EXISTS idx_sessions_analytics_optimized;
DROP INDEX IF EXISTS idx_errors_stats_optimized;