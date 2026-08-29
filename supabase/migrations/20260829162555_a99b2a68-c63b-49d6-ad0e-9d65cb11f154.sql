CREATE TABLE public.scan_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.digital_files(id) ON DELETE CASCADE,
  page_label text,
  page_index integer,
  ai_text text,
  verified_text text,
  status text NOT NULL DEFAULT 'not_started',
  model text,
  error text,
  ai_generated_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_transcriptions TO authenticated;
GRANT ALL ON public.scan_transcriptions TO service_role;

ALTER TABLE public.scan_transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own scan transcriptions" ON public.scan_transcriptions FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER scan_transcriptions_updated BEFORE UPDATE ON public.scan_transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX scan_transcriptions_letter_idx ON public.scan_transcriptions (letter_id);
CREATE INDEX scan_transcriptions_status_idx ON public.scan_transcriptions (owner_id, status);

ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS transcription_ai_generated_at timestamptz;