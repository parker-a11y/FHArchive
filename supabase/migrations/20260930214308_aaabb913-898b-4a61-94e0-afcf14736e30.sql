-- lovable-cron-fallback-reviewed: armed only while scheduled emails wait (wake-on-enqueue, unschedule-after-drain); 5-min send window required
CREATE OR REPLACE FUNCTION public.sync_scheduled_email_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $fn$
DECLARE waiting boolean; armed boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.archive_emails WHERE status = 'scheduled') INTO waiting;
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-archive-emails') INTO armed;
  IF waiting AND NOT armed THEN
    PERFORM cron.schedule('scheduled-archive-emails', '*/5 * * * *', $job$
      SELECT net.http_post(
        url := 'https://fharchive.com/api/public/scheduled-emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM public.job_config WHERE key = 'cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000
      );
    $job$);
  ELSIF NOT waiting AND armed THEN
    PERFORM cron.unschedule('scheduled-archive-emails');
  END IF;
  RETURN NULL;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.sync_scheduled_email_job() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-archive-emails') THEN
    PERFORM cron.unschedule('scheduled-archive-emails');
  END IF;
  IF EXISTS (SELECT 1 FROM public.archive_emails WHERE status = 'scheduled') THEN
    PERFORM cron.schedule('scheduled-archive-emails', '*/5 * * * *', $job$
      SELECT net.http_post(
        url := 'https://fharchive.com/api/public/scheduled-emails',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT value FROM public.job_config WHERE key = 'cron_secret')),
        body := '{}'::jsonb, timeout_milliseconds := 300000);
    $job$);
  END IF;
  BEGIN
    PERFORM cron.unschedule('on-this-date-backfill');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM cron.schedule('on-this-date-backfill', '7 * * * *', $job$
    SELECT net.http_post(
      url := 'https://fharchive.com/api/public/on-this-date-backfill',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT value FROM public.job_config WHERE key = 'cron_secret')),
      body := '{}'::jsonb, timeout_milliseconds := 300000);
  $job$);
END $$;