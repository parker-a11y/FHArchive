SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'archivist-daily-digest';

SELECT cron.schedule(
  'archivist-daily-digest',
  '15 7 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://letter-loom-archive.lovable.app/api/public/archivist-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.job_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);