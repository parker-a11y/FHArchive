CREATE TABLE public.label_prints (
  letter_id uuid PRIMARY KEY REFERENCES public.letters(id) ON DELETE CASCADE,
  printed_at timestamptz NOT NULL DEFAULT now(),
  printed_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_prints TO authenticated;
GRANT ALL ON public.label_prints TO service_role;
ALTER TABLE public.label_prints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read label prints" ON public.label_prints FOR SELECT TO authenticated USING (public.can_edit_archive(auth.uid()));
CREATE POLICY "Editors add label prints" ON public.label_prints FOR INSERT TO authenticated WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "Editors update label prints" ON public.label_prints FOR UPDATE TO authenticated USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()));