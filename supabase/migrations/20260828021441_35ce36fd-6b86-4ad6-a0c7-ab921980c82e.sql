ALTER TABLE public.digital_sources
  ADD COLUMN IF NOT EXISTS normalized_date date,
  ADD COLUMN IF NOT EXISTS date_precision text NOT NULL DEFAULT 'unknown';

CREATE OR REPLACE FUNCTION public.create_digital_source(
  p_title text, p_source_type text, p_creator text, p_institution text,
  p_original_date text, p_date_accessed date, p_historical_date_range text,
  p_url text, p_description text, p_notes text,
  p_normalized_date date DEFAULT NULL, p_date_precision text DEFAULT 'unknown')
 RETURNS TABLE(id uuid, ds_seq integer, ds_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_seq integer; v_id uuid; v_dsid text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.ds_counter (owner_id, last_seq) VALUES (auth.uid(), 1)
  ON CONFLICT (owner_id) DO UPDATE SET last_seq = ds_counter.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO v_seq;
  v_dsid := 'DS-' || lpad(v_seq::text, 4, '0');
  INSERT INTO public.digital_sources (
    owner_id, ds_seq, ds_id, title, source_type, creator, institution,
    original_date, date_accessed, historical_date_range, url, description, notes,
    normalized_date, date_precision
  ) VALUES (
    auth.uid(), v_seq, v_dsid, p_title, p_source_type, p_creator, p_institution,
    p_original_date, p_date_accessed, p_historical_date_range, p_url, p_description, p_notes,
    p_normalized_date, COALESCE(p_date_precision, 'unknown')
  ) RETURNING digital_sources.id INTO v_id;
  RETURN QUERY SELECT v_id, v_seq, v_dsid;
END $function$;

CREATE TABLE IF NOT EXISTS public.ds_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  source_id uuid NOT NULL REFERENCES public.digital_sources(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text,
  file_label text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT 'other',
  mime_type text,
  file_size bigint,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ds_files TO authenticated;
GRANT ALL ON public.ds_files TO service_role;

ALTER TABLE public.ds_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their ds files"
  ON public.ds_files FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ds_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS ds_files_source_idx ON public.ds_files(source_id, sort_order);

CREATE POLICY "Owners read ds-files objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ds-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners upload ds-files objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ds-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners update ds-files objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ds-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete ds-files objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ds-files' AND auth.uid()::text = (storage.foldername(name))[1]);