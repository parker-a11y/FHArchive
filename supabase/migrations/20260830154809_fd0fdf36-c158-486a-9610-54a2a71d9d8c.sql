ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;
ALTER TABLE public.digital_sources ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS letters_starred_idx ON public.letters (owner_id) WHERE starred;
CREATE INDEX IF NOT EXISTS digital_sources_starred_idx ON public.digital_sources (owner_id) WHERE starred;