ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';
ALTER TABLE public.letters DROP CONSTRAINT IF EXISTS letters_visibility_check;
ALTER TABLE public.letters ADD CONSTRAINT letters_visibility_check CHECK (visibility IN ('private','shared','published'));

CREATE TABLE IF NOT EXISTS public.record_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.digital_files(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'record' CHECK (scope IN ('record','file')),
  token text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  include_transcription boolean NOT NULL DEFAULT true,
  include_notes boolean NOT NULL DEFAULT false,
  public_note text,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS record_shares_letter_idx ON public.record_shares(letter_id);
CREATE INDEX IF NOT EXISTS record_shares_token_idx ON public.record_shares(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_shares TO authenticated;
GRANT ALL ON public.record_shares TO service_role;
ALTER TABLE public.record_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their shares" ON public.record_shares;
CREATE POLICY "Owners manage their shares" ON public.record_shares FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);