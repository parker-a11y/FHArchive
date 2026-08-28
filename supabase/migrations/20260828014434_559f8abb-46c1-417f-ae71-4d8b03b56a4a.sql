CREATE TABLE public.ds_counter (
  owner_id uuid NOT NULL DEFAULT auth.uid() PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ds_counter TO authenticated;
GRANT ALL ON public.ds_counter TO service_role;
ALTER TABLE public.ds_counter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ds counter" ON public.ds_counter FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.digital_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  ds_seq integer NOT NULL,
  ds_id text NOT NULL,
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'website',
  creator text,
  institution text,
  original_date text,
  date_accessed date,
  historical_date_range text,
  url text,
  description text,
  notes text,
  transcript text,
  rights_notes text,
  citation text,
  local_file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, ds_seq),
  UNIQUE (owner_id, ds_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_sources TO authenticated;
GRANT ALL ON public.digital_sources TO service_role;
ALTER TABLE public.digital_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sources" ON public.digital_sources FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.digital_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ds_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  source_id uuid NOT NULL REFERENCES public.digital_sources(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  start_ts text,
  end_ts text,
  title text NOT NULL,
  description text,
  url text,
  keywords text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ds_segments TO authenticated;
GRANT ALL ON public.ds_segments TO service_role;
ALTER TABLE public.ds_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own segments" ON public.ds_segments FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ds_segments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.letter_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.digital_sources(id) ON DELETE CASCADE,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (letter_id, source_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_sources TO authenticated;
GRANT ALL ON public.letter_sources TO service_role;
ALTER TABLE public.letter_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own letter_sources" ON public.letter_sources FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.ds_people (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  source_id uuid NOT NULL REFERENCES public.digital_sources(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'mentioned',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, person_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ds_people TO authenticated;
GRANT ALL ON public.ds_people TO service_role;
ALTER TABLE public.ds_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ds_people" ON public.ds_people FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.ds_places (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  source_id uuid NOT NULL REFERENCES public.digital_sources(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'mentioned',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, place_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ds_places TO authenticated;
GRANT ALL ON public.ds_places TO service_role;
ALTER TABLE public.ds_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ds_places" ON public.ds_places FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.ds_organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  source_id uuid NOT NULL REFERENCES public.digital_sources(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'mentioned',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, organization_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ds_organizations TO authenticated;
GRANT ALL ON public.ds_organizations TO service_role;
ALTER TABLE public.ds_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ds_organizations" ON public.ds_organizations FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.ds_keywords (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  source_id uuid NOT NULL REFERENCES public.digital_sources(id) ON DELETE CASCADE,
  keyword_id uuid NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, keyword_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ds_keywords TO authenticated;
GRANT ALL ON public.ds_keywords TO service_role;
ALTER TABLE public.ds_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ds_keywords" ON public.ds_keywords FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.ds_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  source_id uuid NOT NULL REFERENCES public.digital_sources(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, event_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ds_events TO authenticated;
GRANT ALL ON public.ds_events TO service_role;
ALTER TABLE public.ds_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ds_events" ON public.ds_events FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.preview_next_ds_id()
RETURNS TABLE(ds_seq integer, ds_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT c.last_seq + 1 INTO v_seq FROM public.ds_counter c WHERE c.owner_id = auth.uid();
  v_seq := COALESCE(v_seq, 1);
  RETURN QUERY SELECT v_seq, 'DS-' || lpad(v_seq::text, 4, '0');
END $$;
REVOKE ALL ON FUNCTION public.preview_next_ds_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_next_ds_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_digital_source(
  p_title text,
  p_source_type text,
  p_creator text,
  p_institution text,
  p_original_date text,
  p_date_accessed date,
  p_historical_date_range text,
  p_url text,
  p_description text,
  p_notes text
)
RETURNS TABLE(id uuid, ds_seq integer, ds_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq integer; v_id uuid; v_dsid text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.ds_counter (owner_id, last_seq) VALUES (auth.uid(), 1)
  ON CONFLICT (owner_id) DO UPDATE SET last_seq = ds_counter.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO v_seq;
  v_dsid := 'DS-' || lpad(v_seq::text, 4, '0');
  INSERT INTO public.digital_sources (
    owner_id, ds_seq, ds_id, title, source_type, creator, institution,
    original_date, date_accessed, historical_date_range, url, description, notes
  ) VALUES (
    auth.uid(), v_seq, v_dsid, p_title, p_source_type, p_creator, p_institution,
    p_original_date, p_date_accessed, p_historical_date_range, p_url, p_description, p_notes
  ) RETURNING digital_sources.id INTO v_id;
  RETURN QUERY SELECT v_id, v_seq, v_dsid;
END $$;
REVOKE ALL ON FUNCTION public.create_digital_source(text,text,text,text,text,date,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_digital_source(text,text,text,text,text,date,text,text,text,text) TO authenticated;