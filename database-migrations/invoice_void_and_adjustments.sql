ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS is_void BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS voided_reason TEXT;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS voided_by UUID;

CREATE INDEX IF NOT EXISTS idx_invoices_is_void ON invoices(is_void);

CREATE TABLE IF NOT EXISTS invoice_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  adjustment_date DATE NOT NULL DEFAULT (now()::date),
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_invoice_adjustments_invoice_id ON invoice_adjustments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_adjustments_patient_id ON invoice_adjustments(patient_id);
