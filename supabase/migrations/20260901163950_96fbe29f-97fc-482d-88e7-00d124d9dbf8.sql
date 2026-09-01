CREATE TABLE public.weekly_recaps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  week_start date not null,
  week_end date not null,
  title text not null default '',
  lede text,
  body_md text not null default '',
  related_ids text[] not null default '{}',
  image_bucket text,
  image_path text,
  image_archive_id text,
  image_caption text,
  stats jsonb not null default '{}'::jsonb,
  model text,
  status text not null default 'draft',
  manually_edited boolean not null default false,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_start)
);

CREATE INDEX weekly_recaps_week_start_idx ON public.weekly_recaps (week_start DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_recaps TO authenticated;
GRANT ALL ON public.weekly_recaps TO service_role;

ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Archive readers see published recaps"
ON public.weekly_recaps FOR SELECT TO authenticated
USING (
  (status = 'published' AND public.can_read_archive(auth.uid()))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins insert recaps"
ON public.weekly_recaps FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update recaps"
ON public.weekly_recaps FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete recaps"
ON public.weekly_recaps FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER weekly_recaps_updated_at
BEFORE UPDATE ON public.weekly_recaps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

SELECT cron.schedule(
  'weekly-francis-recap',
  '0 6 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://letter-loom-archive.lovable.app/api/public/weekly-recap',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.job_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);