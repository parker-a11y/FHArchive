select cron.schedule(
  'nightly-research-snapshot',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://letter-loom-archive.lovable.app/api/public/research-snapshot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.job_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);