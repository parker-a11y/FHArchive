ALTER TABLE public.book_items DROP CONSTRAINT IF EXISTS book_items_kind_check;
ALTER TABLE public.book_items ADD CONSTRAINT book_items_kind_check CHECK ((item_type = 'record' AND letter_id IS NOT NULL) OR (item_type IN ('page', 'chapter') AND page_doc IS NOT NULL)) NOT VALID;
ALTER TABLE public.book_exports ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'interior';
ALTER TABLE public.book_exports ADD COLUMN IF NOT EXISTS print_ready boolean NOT NULL DEFAULT false;
CREATE TABLE public.book_covers (
  book_id uuid PRIMARY KEY REFERENCES public.book_projects(id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_covers TO authenticated;
GRANT ALL ON public.book_covers TO service_role;
ALTER TABLE public.book_covers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors manage book covers" ON public.book_covers FOR ALL TO authenticated
  USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));