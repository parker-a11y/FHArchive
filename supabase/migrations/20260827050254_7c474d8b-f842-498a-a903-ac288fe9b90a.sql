
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.archive_counter (
  owner_id UUID PRIMARY KEY DEFAULT auth.uid(),
  last_seq INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_counter TO authenticated;
GRANT ALL ON public.archive_counter TO service_role;
ALTER TABLE public.archive_counter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own counter" ON public.archive_counter FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  fh_seq INTEGER NOT NULL,
  archive_id TEXT NOT NULL,
  date_as_written TEXT,
  normalized_date DATE,
  date_precision TEXT NOT NULL DEFAULT 'unknown',
  date_certainty TEXT NOT NULL DEFAULT 'unknown',
  author TEXT,
  recipient TEXT,
  origin TEXT,
  destination TEXT,
  period TEXT NOT NULL DEFAULT 'unknown',
  sheets INTEGER,
  image_count INTEGER NOT NULL DEFAULT 0,
  has_envelope BOOLEAN NOT NULL DEFAULT false,
  has_enclosures BOOLEAN NOT NULL DEFAULT false,
  physical_condition TEXT,
  notes TEXT,
  transcription_raw_ai TEXT,
  transcription_verified TEXT,
  transcription_status TEXT NOT NULL DEFAULT 'not_started',
  scan_status TEXT NOT NULL DEFAULT 'not_scanned',
  review_status TEXT NOT NULL DEFAULT 'not_reviewed',
  research_needed BOOLEAN NOT NULL DEFAULT false,
  summary_short TEXT,
  summary_long TEXT,
  publication_status TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, fh_seq),
  UNIQUE (owner_id, archive_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letters TO authenticated;
GRANT ALL ON public.letters TO service_role;
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own letters" ON public.letters FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER letters_updated BEFORE UPDATE ON public.letters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX letters_seq_idx ON public.letters (owner_id, fh_seq);
CREATE INDEX letters_date_idx ON public.letters (owner_id, normalized_date);

CREATE TABLE public.letter_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_label TEXT NOT NULL,
  image_type TEXT NOT NULL DEFAULT 'other',
  sort_order INTEGER NOT NULL DEFAULT 0,
  rotation INTEGER NOT NULL DEFAULT 0,
  original_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_scans TO authenticated;
GRANT ALL ON public.letter_scans TO service_role;
ALTER TABLE public.letter_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scans" ON public.letter_scans FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER scans_updated BEFORE UPDATE ON public.letter_scans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  alternate_names TEXT,
  relationship TEXT,
  biographical_notes TEXT,
  birth_date TEXT,
  death_date TEXT,
  research_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own people" ON public.people FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER people_updated BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  canonical_name TEXT NOT NULL,
  name_as_written TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  historical_notes TEXT,
  research_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.places TO authenticated;
GRANT ALL ON public.places TO service_role;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own places" ON public.places FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER places_updated BEFORE UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keywords TO authenticated;
GRANT ALL ON public.keywords TO service_role;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own keywords" ON public.keywords FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.letter_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'human',
  confirmed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (letter_id, keyword_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_keywords TO authenticated;
GRANT ALL ON public.letter_keywords TO service_role;
ALTER TABLE public.letter_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own letter_keywords" ON public.letter_keywords FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.letter_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'mentioned',
  source TEXT NOT NULL DEFAULT 'human',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (letter_id, person_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_people TO authenticated;
GRANT ALL ON public.letter_people TO service_role;
ALTER TABLE public.letter_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own letter_people" ON public.letter_people FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.letter_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'mentioned',
  source TEXT NOT NULL DEFAULT 'human',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (letter_id, place_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_places TO authenticated;
GRANT ALL ON public.letter_places TO service_role;
ALTER TABLE public.letter_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own letter_places" ON public.letter_places FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.historical_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  ref_type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  research_status TEXT NOT NULL DEFAULT 'not_started',
  notes TEXT,
  source_links TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historical_references TO authenticated;
GRANT ALL ON public.historical_references TO service_role;
ALTER TABLE public.historical_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own refs" ON public.historical_references FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER refs_updated BEFORE UPDATE ON public.historical_references FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.letter_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  related_letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'other',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (letter_id, related_letter_id, relation_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_relations TO authenticated;
GRANT ALL ON public.letter_relations TO service_role;
ALTER TABLE public.letter_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own relations" ON public.letter_relations FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  content TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_suggestions TO authenticated;
GRANT ALL ON public.ai_suggestions TO service_role;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai" ON public.ai_suggestions FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER ai_updated BEFORE UPDATE ON public.ai_suggestions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  letter_id UUID REFERENCES public.letters(id) ON DELETE CASCADE,
  entity TEXT NOT NULL DEFAULT 'letter',
  field_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.edit_history TO authenticated;
GRANT ALL ON public.edit_history TO service_role;
ALTER TABLE public.edit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history read" ON public.edit_history FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own history write" ON public.edit_history FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE INDEX edit_history_letter_idx ON public.edit_history (letter_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.next_archive_id()
RETURNS TABLE (fh_seq INTEGER, archive_id TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); n INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.archive_counter(owner_id, last_seq)
  VALUES (uid, 0) ON CONFLICT (owner_id) DO NOTHING;
  UPDATE public.archive_counter c
     SET last_seq = GREATEST(c.last_seq, COALESCE((SELECT MAX(l.fh_seq) FROM public.letters l WHERE l.owner_id = uid), 0)) + 1,
         updated_at = now()
   WHERE c.owner_id = uid
  RETURNING c.last_seq INTO n;
  RETURN QUERY SELECT n, 'FH' || lpad(n::text, 6, '0');
END; $$;
GRANT EXECUTE ON FUNCTION public.next_archive_id() TO authenticated;

CREATE POLICY "own scan files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'scans' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'scans' AND owner = auth.uid());
