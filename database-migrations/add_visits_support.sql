-- Add first-class Visit tracking (decouple visits from invoices)

-- 1) Visits table
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  visit_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id, visit_number),
  UNIQUE(patient_id, visit_date)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient_date ON visits(patient_id, visit_date);

-- 2) Link invoices/payments to visits
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id);

CREATE INDEX IF NOT EXISTS idx_invoices_visit_id ON invoices(visit_id);
CREATE INDEX IF NOT EXISTS idx_payments_visit_id ON payments(visit_id);

-- 3) Backfill visits from existing invoices (Option A: 1 visit per patient per day)
WITH invoice_days AS (
  SELECT DISTINCT
    i.patient_id,
    COALESCE(i.invoice_date, i.created_at::date) AS visit_date
  FROM invoices i
),
ordered_days AS (
  SELECT
    patient_id,
    visit_date,
    ROW_NUMBER() OVER (
      PARTITION BY patient_id
      ORDER BY visit_date ASC
    ) AS visit_number
  FROM invoice_days
),
inserted_visits AS (
  INSERT INTO visits (patient_id, visit_date, visit_number)
  SELECT patient_id, visit_date, visit_number
  FROM ordered_days
  ON CONFLICT (patient_id, visit_date) DO NOTHING
  RETURNING id, patient_id, visit_date
)
SELECT 1;

-- 4) Attach invoices to their backfilled visits
WITH invoice_dates AS (
  SELECT
    i.id AS invoice_id,
    i.patient_id,
    COALESCE(i.invoice_date, i.created_at::date) AS visit_date
  FROM invoices i
)
UPDATE invoices i
SET visit_id = v.id
FROM invoice_dates d
JOIN visits v
  ON v.patient_id = d.patient_id
 AND v.visit_date = d.visit_date
WHERE i.id = d.invoice_id
  AND i.visit_id IS NULL;

-- 5) Attach payments to their invoice visit when missing (legacy)
UPDATE payments p
SET visit_id = i.visit_id
FROM invoices i
WHERE p.invoice_id = i.id
  AND p.visit_id IS NULL
  AND i.visit_id IS NOT NULL;
