ALTER TABLE public.weekly_recaps
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS range_label text,
  ADD COLUMN IF NOT EXISTS params jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.weekly_recaps DROP CONSTRAINT IF EXISTS weekly_recaps_week_start_key;

CREATE UNIQUE INDEX IF NOT EXISTS weekly_recaps_weekly_week_start_idx
  ON public.weekly_recaps (week_start) WHERE kind = 'weekly';

CREATE UNIQUE INDEX IF NOT EXISTS weekly_recaps_slug_idx
  ON public.weekly_recaps (slug) WHERE slug IS NOT NULL;