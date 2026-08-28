ALTER TABLE public.digital_sources ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

CREATE TABLE public.source_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.digital_sources(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.ds_files(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'record',
  token text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  include_transcript boolean NOT NULL DEFAULT true,
  include_notes boolean NOT NULL DEFAULT false,
  public_note text,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_shares TO authenticated;
GRANT ALL ON public.source_shares TO service_role;

ALTER TABLE public.source_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own source shares"
ON public.source_shares FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

ALTER TABLE public.source_shares ALTER COLUMN owner_id SET DEFAULT auth.uid();

CREATE INDEX source_shares_source_idx ON public.source_shares (source_id);