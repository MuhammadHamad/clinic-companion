-- Normalize visits to Option A: 1 visit per patient per day
--
-- What it does:
-- 1) Merges duplicate visits (same patient_id + visit_date) into a single visit
-- 2) Re-points invoices/payments to the kept visit
-- 3) Deletes duplicate visits
-- 4) Re-numbers visit_number sequentially per patient by date
-- 5) Enforces uniqueness on (patient_id, visit_date)

BEGIN;

-- 1) Pick a single visit to keep per patient per day (earliest created)
WITH keeper AS (
  SELECT DISTINCT ON (patient_id, visit_date)
    id AS keep_id,
    patient_id,
    visit_date
  FROM visits
  ORDER BY patient_id, visit_date, created_at ASC, id ASC
)
-- 2) Re-point invoices to keeper visit for same (patient_id, visit_date)
UPDATE invoices i
SET visit_id = k.keep_id
FROM visits v
JOIN keeper k
  ON k.patient_id = v.patient_id
 AND k.visit_date = v.visit_date
WHERE i.visit_id = v.id
  AND i.visit_id IS NOT NULL
  AND v.id <> k.keep_id;

-- 3) Re-point payments to keeper visit for same (patient_id, visit_date)
WITH keeper AS (
  SELECT DISTINCT ON (patient_id, visit_date)
    id AS keep_id,
    patient_id,
    visit_date
  FROM visits
  ORDER BY patient_id, visit_date, created_at ASC, id ASC
)
UPDATE payments p
SET visit_id = k.keep_id
FROM visits v
JOIN keeper k
  ON k.patient_id = v.patient_id
 AND k.visit_date = v.visit_date
WHERE p.visit_id = v.id
  AND p.visit_id IS NOT NULL
  AND v.id <> k.keep_id;

-- 4) Delete non-keeper duplicate visits
WITH keeper AS (
  SELECT DISTINCT ON (patient_id, visit_date)
    id AS keep_id,
    patient_id,
    visit_date
  FROM visits
  ORDER BY patient_id, visit_date, created_at ASC, id ASC
)
DELETE FROM visits v
USING keeper k
WHERE v.patient_id = k.patient_id
  AND v.visit_date = k.visit_date
  AND v.id <> k.keep_id;

-- 5) Re-number visit_number sequentially per patient by date
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY patient_id
      ORDER BY visit_date ASC, created_at ASC, id ASC
    ) AS new_visit_number
  FROM visits
)
UPDATE visits v
SET visit_number = n.new_visit_number
FROM numbered n
WHERE v.id = n.id;

-- 6) Enforce uniqueness: 1 visit per patient per day
-- (After merge, this should succeed.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'visits_patient_date_unique'
  ) THEN
    CREATE UNIQUE INDEX visits_patient_date_unique
      ON visits(patient_id, visit_date);
  END IF;
END $$;

COMMIT;
