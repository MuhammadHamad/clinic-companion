-- Add 'archived' to patient_status enum
-- This allows patients to have archived status

-- Step 1: Add 'archived' to the existing enum type
ALTER TYPE patient_status_enum ADD VALUE 'archived';

-- Step 2: Add archived_at column (if not already added)
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Step 3: Add comments for clarity
COMMENT ON COLUMN patients.status IS 'Patient status: active, inactive, or archived';
COMMENT ON COLUMN patients.archived_at IS 'Timestamp when patient was archived (null for active/inactive patients)';
