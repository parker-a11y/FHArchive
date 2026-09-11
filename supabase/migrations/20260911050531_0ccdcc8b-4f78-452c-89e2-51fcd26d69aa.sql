-- lovable-cron-fallback-reviewed: 144 runs/day; freshness requirement is "searchable within minutes" after an edit; each run exits immediately when the change queue is empty.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'incremental-research-reindex';

SELECT cron.schedule(
  'incremental-research-reindex',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://letter-loom-archive.lovable.app/api/public/research-reindex',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.job_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);