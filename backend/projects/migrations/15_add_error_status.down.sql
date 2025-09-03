-- Remove error status management columns
DROP INDEX IF EXISTS idx_errors_assigned_to;
DROP INDEX IF EXISTS idx_errors_status;

ALTER TABLE errors 
DROP COLUMN IF EXISTS resolution_notes,
DROP COLUMN IF EXISTS resolved_at,
DROP COLUMN IF EXISTS assigned_to,
DROP COLUMN IF EXISTS status;