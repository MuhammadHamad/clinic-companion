-- Universal migration for adding archived support
-- This works regardless of current enum type name

-- Step 1: Check what enum types exist and add archived value
DO $$
BEGIN
    -- Try to add to patient_status_enum first
    BEGIN
        ALTER TYPE patient_status_enum ADD VALUE 'archived';
    EXCEPTION WHEN OTHERS THEN
        -- If that fails, try patient_status (without _enum)
        BEGIN
            ALTER TYPE patient_status ADD VALUE 'archived';
        EXCEPTION WHEN OTHERS THEN
            -- If that also fails, create the enum type
            DO $$
                BEGIN
                    -- Create new enum with all values
                    CREATE TYPE patient_status_new AS ENUM ('active', 'inactive', 'archived');
                    
                    -- Update the column to use new enum
                    ALTER TABLE patients ALTER COLUMN status TYPE patient_status_new 
                    USING CASE 
                        WHEN status = 'active' THEN 'active'::patient_status_new
                        WHEN status = 'inactive' THEN 'inactive'::patient_status_new
                        ELSE 'archived'::patient_status_new
                    END;
                    
                    -- Drop old enum type if it exists
                    DROP TYPE IF EXISTS patient_status;
                    DROP TYPE IF EXISTS patient_status_enum;
                    
                    -- Rename new enum to standard name
                    ALTER TYPE patient_status_new RENAME TO patient_status;
                EXCEPTION WHEN duplicate_object THEN
                    -- If enum already exists, just add the value
                    ALTER TYPE patient_status ADD VALUE IF NOT EXISTS 'archived';
                END;
            END;
    END;
END $$;

-- Step 2: Add archived_at column (if not already added)
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Step 3: Add comments for clarity
COMMENT ON COLUMN patients.status IS 'Patient status: active, inactive, or archived';
COMMENT ON COLUMN patients.archived_at IS 'Timestamp when patient was archived (null for active/inactive patients)';
