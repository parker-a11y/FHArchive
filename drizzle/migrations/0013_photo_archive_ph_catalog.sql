CREATE TABLE public.photo_counter (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_seq int NOT NULL DEFAULT 0,
  numbering_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.photo_counter TO authenticated;
GRANT ALL ON public.photo_counter TO service_role;
ALTER TABLE public.photo_counter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readers view photo counter" ON public.photo_counter FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
INSERT INTO public.photo_counter (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.photo_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_batches TO authenticated;
GRANT ALL ON public.photo_batches TO service_role;
ALTER TABLE public.photo_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readers view photo batches" ON public.photo_batches FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "editors add photo batches" ON public.photo_batches FOR INSERT TO authenticated WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "editors update photo batches" ON public.photo_batches FOR UPDATE TO authenticated USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "admins remove photo batches" ON public.photo_batches FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.photo_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photo_boxes_code_key UNIQUE (code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_boxes TO authenticated;
GRANT ALL ON public.photo_boxes TO service_role;
ALTER TABLE public.photo_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readers view photo boxes" ON public.photo_boxes FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "admins add photo boxes" ON public.photo_boxes FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins update photo boxes" ON public.photo_boxes FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins remove photo boxes" ON public.photo_boxes FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.photo_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_key text GENERATED ALWAYS AS (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) STORED,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photo_categories_name_key_key UNIQUE (name_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_categories TO authenticated;
GRANT ALL ON public.photo_categories TO service_role;
ALTER TABLE public.photo_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readers view photo categories" ON public.photo_categories FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "admins add photo categories" ON public.photo_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins update photo categories" ON public.photo_categories FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins remove photo categories" ON public.photo_categories FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.photo_category_links (
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.photo_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, category_id)
);
CREATE INDEX photo_category_links_category_idx ON public.photo_category_links(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_category_links TO authenticated;
GRANT ALL ON public.photo_category_links TO service_role;
ALTER TABLE public.photo_category_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readers view photo category links" ON public.photo_category_links FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "admins add photo category links" ON public.photo_category_links FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins remove photo category links" ON public.photo_category_links FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.photos
  ADD COLUMN ph_seq int,
  ADD COLUMN ph_id text GENERATED ALWAYS AS (CASE WHEN ph_seq IS NULL THEN NULL WHEN ph_seq >= 100000 THEN 'PH' || ph_seq::text ELSE 'PH' || lpad(ph_seq::text, 5, '0') END) STORED,
  ADD COLUMN batch_id uuid REFERENCES public.photo_batches(id) ON DELETE SET NULL,
  ADD COLUMN box_id uuid REFERENCES public.photo_boxes(id) ON DELETE SET NULL,
  ADD COLUMN people text,
  ADD COLUMN date_text text,
  ADD COLUMN date_year_start int,
  ADD COLUMN date_year_end int,
  ADD COLUMN location text,
  ADD COLUMN inscription text,
  ADD COLUMN info_source text,
  ADD COLUMN back_transcription text,
  ADD COLUMN original_filename text;
CREATE UNIQUE INDEX photos_ph_seq_key ON public.photos(ph_seq);
CREATE INDEX photos_box_idx ON public.photos(box_id);
CREATE INDEX photos_batch_idx ON public.photos(batch_id);

CREATE OR REPLACE FUNCTION public.photos_assign_ph()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.photo_counter;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.ph_seq IS NOT NULL AND NEW.ph_seq IS DISTINCT FROM OLD.ph_seq THEN
      RAISE EXCEPTION 'PH numbers are permanent and cannot be changed';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.ph_seq IS NULL THEN
    SELECT * INTO c FROM public.photo_counter WHERE id = 1 FOR UPDATE;
    IF c.numbering_enabled THEN
      UPDATE public.photo_counter SET last_seq = last_seq + 1, updated_at = now() WHERE id = 1 RETURNING last_seq INTO NEW.ph_seq;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER photos_assign_ph BEFORE INSERT OR UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.photos_assign_ph();

CREATE OR REPLACE FUNCTION public.assign_ph_numbers()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0; s int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only administrators can number photographs'; END IF;
  PERFORM 1 FROM public.photo_counter WHERE id = 1 FOR UPDATE;
  SELECT greatest(c.last_seq, coalesce((SELECT max(ph_seq) FROM public.photos), 0)) INTO s FROM public.photo_counter c WHERE id = 1;
  FOR r IN SELECT id FROM public.photos WHERE ph_seq IS NULL ORDER BY created_at, id LOOP
    s := s + 1;
    UPDATE public.photos SET ph_seq = s WHERE id = r.id;
    n := n + 1;
  END LOOP;
  UPDATE public.photo_counter SET last_seq = s, numbering_enabled = true, updated_at = now() WHERE id = 1;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.assign_ph_numbers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assign_ph_numbers() TO authenticated;