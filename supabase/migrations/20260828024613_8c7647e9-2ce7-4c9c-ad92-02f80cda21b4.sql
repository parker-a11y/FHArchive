CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.job_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.job_config TO service_role;
ALTER TABLE public.job_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to job config" ON public.job_config FOR SELECT TO authenticated USING (false);

SELECT cron.unschedule('nightly-archive-backup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-archive-backup');

SELECT cron.schedule(
  'nightly-archive-backup',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--5c76849c-188e-4ca6-861e-84bedb8d22d4-dev.lovable.app/api/public/backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.job_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 240000
  );
  $$
);