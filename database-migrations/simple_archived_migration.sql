-- Simple migration to add archived support
-- Step 1: Add archived_at column first
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Try to add archived to existing enum (most common scenario)
ALTER TYPE patient_status ADD VALUE 'archived';

-- If the above fails, your enum might be named differently
-- Run this instead:
-- ALTER TYPE patient_status_enum ADD VALUE 'archived';

-- Add comments
COMMENT ON COLUMN patients.status IS 'Patient status: active, inactive, or archived';
COMMENT ON COLUMN patients.archived_at IS 'Timestamp when patient was archived (null for active/inactive patients)';
