ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS dateline_suggested text;
COMMENT ON COLUMN public.letters.dateline IS 'Location Line — the place written on the document itself (not the postmark).';
COMMENT ON COLUMN public.letters.dateline_suggested IS 'AI-suggested Location Line awaiting archivist acceptance or correction.';