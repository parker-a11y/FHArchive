ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS identification_status text NOT NULL DEFAULT 'unidentified',
  ADD COLUMN IF NOT EXISTS storage_type text,
  ADD COLUMN IF NOT EXISTS storage_container text,
  ADD COLUMN IF NOT EXISTS storage_folder text,
  ADD COLUMN IF NOT EXISTS storage_position text,
  ADD COLUMN IF NOT EXISTS storage_notes text;

UPDATE public.letters
   SET storage_container = storage_location
 WHERE storage_container IS NULL AND storage_location IS NOT NULL;

ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS sort_date date
  GENERATED ALWAYS AS (COALESCE(normalized_date, date_end)) STORED;

CREATE INDEX IF NOT EXISTS letters_sort_date_idx ON public.letters (sort_date);
CREATE INDEX IF NOT EXISTS letters_identification_status_idx ON public.letters (identification_status);