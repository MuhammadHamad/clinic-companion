# Database Migration: Add Archived Support

## Issue
The archive system requires both:
1. `archived_at` column in `patients` table
2. `archived` value in `patient_status` enum

## Root Cause
Database enum `patient_status` only includes 'active' and 'inactive', but our code tries to use 'archived'.

## Solution: Simple Two-Step Migration

Run the following SQL in your Supabase SQL Editor:

```sql
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
```

## How to Apply

### In Supabase SQL Editor:
1. **Run Step 1 first** (adds the column)
2. **Run Step 2** (adds the enum value)
3. If Step 2 fails, try the alternative enum name

## What This Does
- **Simple approach**: No complex nested blocks or DO statements
- **Adds archived_at column**: For timestamp tracking
- **Extends enum**: Adds 'archived' as valid status
- **Backward compatible**: Existing data remains unchanged

## After Migration
Once you run this migration:
- Archive functionality will work without enum errors
- Patients can be archived and restored
- All existing data remains intact
- Dashboard revenue calculations unaffected

## Verification
After running the migration, you can verify it worked by:
```sql
-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'patients' AND column_name = 'archived_at';
```

The archive system will work immediately after this migration is applied.
