CREATE TABLE public.unassigned_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unassigned_photos TO authenticated;
GRANT ALL ON public.unassigned_photos TO service_role;
ALTER TABLE public.unassigned_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readers view unassigned photos" ON public.unassigned_photos FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "editors add unassigned photos" ON public.unassigned_photos FOR INSERT TO authenticated WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "editors update unassigned photos" ON public.unassigned_photos FOR UPDATE TO authenticated USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "editors remove unassigned photos" ON public.unassigned_photos FOR DELETE TO authenticated USING (public.can_edit_archive(auth.uid()));
CREATE INDEX unassigned_photos_created_idx ON public.unassigned_photos (created_at DESC);