CREATE TABLE public.letter_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 1,
  item_type text NOT NULL DEFAULT 'other',
  description text,
  side text,
  page_number text,
  item_date text,
  normalized_date date,
  people text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_items TO authenticated;
GRANT ALL ON public.letter_items TO service_role;

ALTER TABLE public.letter_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own letter_items" ON public.letter_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER letter_items_updated BEFORE UPDATE ON public.letter_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX letter_items_letter_idx ON public.letter_items (letter_id, sort_order);

ALTER TABLE public.letter_scans
  ADD COLUMN item_id uuid REFERENCES public.letter_items(id) ON DELETE SET NULL;

CREATE INDEX letter_scans_item_idx ON public.letter_scans (item_id);