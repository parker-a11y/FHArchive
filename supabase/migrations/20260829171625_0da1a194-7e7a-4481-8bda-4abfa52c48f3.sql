CREATE TABLE public.record_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('record_type','subtype')),
  value text NOT NULL,
  label text NOT NULL,
  parent_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_categories TO authenticated;
GRANT ALL ON public.record_categories TO service_role;

ALTER TABLE public.record_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their categories"
ON public.record_categories FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE UNIQUE INDEX record_categories_unique_label
ON public.record_categories (owner_id, kind, coalesce(parent_type,''), lower(btrim(label)));

CREATE TRIGGER record_categories_updated
BEFORE UPDATE ON public.record_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

UPDATE public.letters SET record_type = 'personal_papers' WHERE record_type = 'ephemera';