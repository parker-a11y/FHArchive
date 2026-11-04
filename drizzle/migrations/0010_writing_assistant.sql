CREATE TABLE public.writing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid,
  title text NOT NULL DEFAULT 'Untitled session',
  record_ids text[] NOT NULL DEFAULT '{}',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writing_sessions TO authenticated;
GRANT ALL ON public.writing_sessions TO service_role;
ALTER TABLE public.writing_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editors manage writing sessions" ON public.writing_sessions FOR ALL TO authenticated USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE INDEX writing_sessions_updated_idx ON public.writing_sessions (updated_at DESC);

CREATE TABLE public.writing_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  instructions text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.writing_settings TO authenticated;
GRANT ALL ON public.writing_settings TO service_role;
ALTER TABLE public.writing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editors read writing settings" ON public.writing_settings FOR SELECT TO authenticated USING (public.can_edit_archive(auth.uid()));
CREATE POLICY "editors write writing settings" ON public.writing_settings FOR INSERT TO authenticated WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "editors update writing settings" ON public.writing_settings FOR UPDATE TO authenticated USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));