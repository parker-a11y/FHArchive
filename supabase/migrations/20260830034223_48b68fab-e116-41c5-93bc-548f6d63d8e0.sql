CREATE TABLE public.rejected_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL,
  name text NOT NULL,
  name_norm text GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rejected_entities_unique ON public.rejected_entities (owner_id, kind, name_norm);

GRANT SELECT, INSERT, DELETE ON public.rejected_entities TO authenticated;
GRANT ALL ON public.rejected_entities TO service_role;

ALTER TABLE public.rejected_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their rejected entities"
  ON public.rejected_entities FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can add rejected entities"
  ON public.rejected_entities FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_admin(auth.uid()));

CREATE POLICY "Owners can remove rejected entities"
  ON public.rejected_entities FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND public.is_admin(auth.uid()));