-- Phase M-A: billing_cutoff_records
--
-- Admin records when the next month's direct debit (口座振替) data has been
-- confirmed/locked. This determines whether pause/cancel requests received
-- after confirmation use next-month or month-after-next effective dates.
--
-- Rollback:
--   DROP TABLE billing_cutoff_records;

CREATE TABLE IF NOT EXISTS billing_cutoff_records (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_month date        NOT NULL UNIQUE,  -- e.g. 2026-05-01 (first day of month)
  confirmed_at  timestamptz NOT NULL DEFAULT now(),
  confirmed_by  uuid        REFERENCES public.users(id),
  note          text
);

COMMENT ON TABLE billing_cutoff_records IS
  'Records when an admin confirms that the direct debit data for a given billing '
  'month is locked. Used to determine pause/cancel effective dates: before confirmation '
  '= next month applies; after confirmation = month-after-next applies.';

COMMENT ON COLUMN billing_cutoff_records.billing_month IS
  'First day of the month whose billing data is confirmed (e.g. 2026-05-01 = May billing).';

-- RLS
ALTER TABLE billing_cutoff_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select billing_cutoff_records"
  ON billing_cutoff_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can insert billing_cutoff_records"
  ON billing_cutoff_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can delete billing_cutoff_records"
  ON billing_cutoff_records FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));
