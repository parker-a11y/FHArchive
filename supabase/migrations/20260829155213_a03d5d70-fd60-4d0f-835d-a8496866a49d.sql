CREATE TABLE public.container_counter (
  owner_id uuid PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.container_counter TO authenticated;
GRANT ALL ON public.container_counter TO service_role;
ALTER TABLE public.container_counter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own container counter" ON public.container_counter FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.source_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  box_seq integer NOT NULL,
  box_id text NOT NULL,
  title text NOT NULL,
  description text,
  container_type text NOT NULL DEFAULT 'box',
  inscriptions text,
  condition text,
  notes text,
  processing_status text NOT NULL DEFAULT 'unprocessed',
  date_photographed date,
  artifact_letter_id uuid REFERENCES public.letters(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, box_seq),
  UNIQUE (owner_id, box_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_containers TO authenticated;
GRANT ALL ON public.source_containers TO service_role;
ALTER TABLE public.source_containers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own source containers" ON public.source_containers FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER source_containers_updated BEFORE UPDATE ON public.source_containers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.container_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  container_id uuid NOT NULL REFERENCES public.source_containers(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text,
  file_label text NOT NULL DEFAULT '',
  mime_type text,
  file_size bigint,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.container_files TO authenticated;
GRANT ALL ON public.container_files TO service_role;
ALTER TABLE public.container_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own container files" ON public.container_files FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER container_files_updated BEFORE UPDATE ON public.container_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX container_files_container_idx ON public.container_files (container_id, sort_order);

ALTER TABLE public.letters
  ADD COLUMN source_container_id uuid REFERENCES public.source_containers(id) ON DELETE SET NULL,
  ADD COLUMN original_order_notes text;

CREATE OR REPLACE FUNCTION public.create_source_container(
  p_title text,
  p_container_type text DEFAULT 'box',
  p_description text DEFAULT NULL,
  p_inscriptions text DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_processing_status text DEFAULT 'unprocessed',
  p_date_photographed date DEFAULT NULL
) RETURNS TABLE(id uuid, box_seq integer, box_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_seq integer; v_id uuid; v_box text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.container_counter (owner_id, last_seq) VALUES (auth.uid(), 1)
  ON CONFLICT (owner_id) DO UPDATE SET last_seq = container_counter.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO v_seq;
  v_box := 'BOX-' || lpad(v_seq::text, 3, '0');
  INSERT INTO public.source_containers (
    owner_id, box_seq, box_id, title, container_type, description,
    inscriptions, condition, notes, processing_status, date_photographed
  ) VALUES (
    auth.uid(), v_seq, v_box, p_title, COALESCE(p_container_type,'box'), p_description,
    p_inscriptions, p_condition, p_notes, COALESCE(p_processing_status,'unprocessed'), p_date_photographed
  ) RETURNING source_containers.id INTO v_id;
  RETURN QUERY SELECT v_id, v_seq, v_box;
END $$;

CREATE POLICY "own container photo objects" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'container-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'container-photos' AND (storage.foldername(name))[1] = auth.uid()::text);