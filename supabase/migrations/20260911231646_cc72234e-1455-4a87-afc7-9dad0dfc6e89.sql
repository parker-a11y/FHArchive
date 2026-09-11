ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS proposed_content text;
ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS ai_source_hash text;