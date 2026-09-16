ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS second_proof_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS second_proof_notes text,
  ADD COLUMN IF NOT EXISTS second_proof_at timestamptz,
  ADD COLUMN IF NOT EXISTS second_proof_by uuid;

CREATE INDEX IF NOT EXISTS letters_second_proof_status_idx ON public.letters (second_proof_status);