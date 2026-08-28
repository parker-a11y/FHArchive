CREATE TABLE public.digital_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  seq integer,
  sort_order integer NOT NULL DEFAULT 1,
  original_filename text NOT NULL,
  master_path text NOT NULL,
  master_mime text,
  master_size bigint,
  label text,
  filename_matches boolean NOT NULL DEFAULT true,
  rotation integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_files TO authenticated;
GRANT ALL ON public.digital_files TO service_role;
ALTER TABLE public.digital_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own digital files" ON public.digital_files FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE INDEX digital_files_letter_idx ON public.digital_files (letter_id, sort_order);

CREATE TRIGGER digital_files_updated BEFORE UPDATE ON public.digital_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.file_derivatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.digital_files(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'complete',
  storage_path text,
  mime_type text,
  file_size bigint,
  width integer,
  height integer,
  text_content text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_derivatives TO authenticated;
GRANT ALL ON public.file_derivatives TO service_role;
ALTER TABLE public.file_derivatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own file derivatives" ON public.file_derivatives FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE INDEX file_derivatives_file_idx ON public.file_derivatives (file_id);
CREATE INDEX file_derivatives_letter_idx ON public.file_derivatives (letter_id);

CREATE TRIGGER file_derivatives_updated BEFORE UPDATE ON public.file_derivatives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.letters
  ADD COLUMN digitization_status text NOT NULL DEFAULT 'not_scanned',
  ADD COLUMN expected_scan_count integer,
  ADD COLUMN completeness_check boolean NOT NULL DEFAULT false,
  ADD COLUMN scan_both_sides boolean NOT NULL DEFAULT true,
  ADD COLUMN photo_front_scanned boolean NOT NULL DEFAULT false,
  ADD COLUMN photo_back_scanned boolean NOT NULL DEFAULT false,
  ADD COLUMN digitization_override boolean NOT NULL DEFAULT false,
  ADD COLUMN digitization_completed_at timestamptz;