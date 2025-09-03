-- Drop export and analytics tables

DROP INDEX IF EXISTS idx_error_impact_group;
DROP INDEX IF EXISTS idx_error_impact_project_date;
DROP INDEX IF EXISTS idx_error_statistics_group;
DROP INDEX IF EXISTS idx_error_statistics_project_time;
DROP INDEX IF EXISTS idx_export_schedules_next_run;
DROP INDEX IF EXISTS idx_export_schedules_project_id;
DROP INDEX IF EXISTS idx_dashboard_exports_expires_at;
DROP INDEX IF EXISTS idx_dashboard_exports_status;
DROP INDEX IF EXISTS idx_dashboard_exports_project_id;

DROP TABLE IF EXISTS error_impact_analysis;
DROP TABLE IF EXISTS error_statistics;
DROP TABLE IF EXISTS export_schedules;
DROP TABLE IF EXISTS dashboard_exports;