CREATE TABLE public.book_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Untitled book',
  subtitle text,
  description text,
  theme text NOT NULL DEFAULT 'classic',
  trim_width_in numeric NOT NULL DEFAULT 8.5,
  trim_height_in numeric NOT NULL DEFAULT 11,
  orientation text NOT NULL DEFAULT 'portrait',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_custom_order jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_projects TO authenticated;
GRANT ALL ON public.book_projects TO service_role;
ALTER TABLE public.book_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors manage book projects" ON public.book_projects FOR ALL TO authenticated
  USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));

CREATE TABLE public.book_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.book_projects(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  item_type text NOT NULL DEFAULT 'record',
  letter_id uuid REFERENCES public.letters(id) ON DELETE CASCADE,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_fingerprint text,
  source_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX book_items_book_idx ON public.book_items(book_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_items TO authenticated;
GRANT ALL ON public.book_items TO service_role;
ALTER TABLE public.book_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors manage book items" ON public.book_items FOR ALL TO authenticated
  USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));

CREATE TABLE public.book_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.book_projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  profile text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  step text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  page_count integer,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX book_exports_status_idx ON public.book_exports(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_exports TO authenticated;
GRANT ALL ON public.book_exports TO service_role;
ALTER TABLE public.book_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors manage book exports" ON public.book_exports FOR ALL TO authenticated
  USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));

CREATE POLICY "Editors read book export files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'book-exports' AND public.can_edit_archive(auth.uid()));