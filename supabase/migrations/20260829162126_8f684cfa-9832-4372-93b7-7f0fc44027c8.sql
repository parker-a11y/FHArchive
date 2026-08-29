ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS tones text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE IF NOT EXISTS public.tone_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tone_options TO authenticated;
GRANT ALL ON public.tone_options TO service_role;

ALTER TABLE public.tone_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their tone options"
ON public.tone_options FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER update_tone_options_updated_at
BEFORE UPDATE ON public.tone_options
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS letters_tones_idx ON public.letters USING gin (tones);