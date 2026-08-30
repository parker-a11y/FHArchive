CREATE TABLE public.archive_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid(),
  author_name text,
  title text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_notes TO authenticated;
GRANT ALL ON public.archive_notes TO service_role;

ALTER TABLE public.archive_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archive members read notes" ON public.archive_notes
  FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "admins insert notes" ON public.archive_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND author_id = auth.uid());
CREATE POLICY "admins update notes" ON public.archive_notes
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins delete notes" ON public.archive_notes
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE INDEX archive_notes_created_idx ON public.archive_notes (created_at DESC);