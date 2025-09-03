-- Add error status management columns
ALTER TABLE errors 
ADD COLUMN status VARCHAR(20) DEFAULT 'new',
ADD COLUMN assigned_to VARCHAR(255),
ADD COLUMN resolved_at TIMESTAMPTZ,
ADD COLUMN resolution_notes TEXT;

-- Create index for status filtering
CREATE INDEX idx_errors_status ON errors(status);
CREATE INDEX idx_errors_assigned_to ON errors(assigned_to);