CREATE TABLE public.photo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('letter','photo','person')),
  target_id uuid NOT NULL,
  certainty text NOT NULL DEFAULT 'documented' CHECK (certainty IN ('documented','recollection','tentative')),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, target_type, target_id)
);
CREATE INDEX photo_links_target_idx ON public.photo_links (target_type, target_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_links TO authenticated;
GRANT ALL ON public.photo_links TO service_role;
ALTER TABLE public.photo_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readers view photo links" ON public.photo_links FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "editors add photo links" ON public.photo_links FOR INSERT TO authenticated WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "editors change photo links" ON public.photo_links FOR UPDATE TO authenticated USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "editors remove photo links" ON public.photo_links FOR DELETE TO authenticated USING (public.can_edit_archive(auth.uid()));