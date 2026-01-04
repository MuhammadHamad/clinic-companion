-- Add archived_at column to patients table
-- This column stores when a patient was archived

ALTER TABLE patients 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;

-- Add comment to explain the column purpose
COMMENT ON COLUMN patients.archived_at IS 'Timestamp when patient was archived (null for active patients)';
