CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  front_path text NOT NULL,
  front_thumb_path text,
  back_path text,
  back_thumb_path text,
  caption text,
  notes text,
  legacy_archive_id text UNIQUE,
  legacy_source text UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO authenticated;
GRANT ALL ON public.photos TO service_role;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readers view photos" ON public.photos FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "editors add photos" ON public.photos FOR INSERT TO authenticated WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "editors update photos" ON public.photos FOR UPDATE TO authenticated USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "editors remove photos" ON public.photos FOR DELETE TO authenticated USING (public.can_edit_archive(auth.uid()));
CREATE INDEX photos_created_idx ON public.photos (created_at DESC);
DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p WHERE p.proname = 'search_letters' AND p.pronamespace = 'public'::regnamespace;
  IF position('moved_to_gallery' in d) = 0 THEN
    d := replace(d, $q$|| ' WHERE ($1 IS NULL OR l.record_type = $1)'$q$, $q$|| ' WHERE l.record_type <> ''moved_to_gallery'' AND ($1 IS NULL OR l.record_type = $1)'$q$);
    EXECUTE d;
  END IF;
END $$;