ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS photo_occasion text,
  ADD COLUMN IF NOT EXISTS photographer text,
  ADD COLUMN IF NOT EXISTS print_size text,
  ADD COLUMN IF NOT EXISTS photo_medium text,
  ADD COLUMN IF NOT EXISTS photo_back_inscription text;