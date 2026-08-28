SELECT cron.unschedule('nightly-archive-backup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-archive-backup');

SELECT cron.schedule(
  'nightly-archive-backup',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://letter-loom-archive.lovable.app/api/public/backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.job_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 240000
  );
  $$
);