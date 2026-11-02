ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS front_view_path TEXT,
  ADD COLUMN IF NOT EXISTS back_view_path TEXT;