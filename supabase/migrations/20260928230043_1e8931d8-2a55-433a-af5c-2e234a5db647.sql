-- lovable-cron-fallback-reviewed: armed only while scheduled emails wait (wake-on-enqueue, unschedule-after-drain); 5-min send window required
ALTER TABLE public.archive_emails
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS send_payload jsonb;
CREATE INDEX IF NOT EXISTS archive_emails_scheduled_idx ON public.archive_emails (scheduled_for) WHERE status = 'scheduled';

-- Keeps the 5-minute sender armed only while scheduled emails are waiting.
CREATE OR REPLACE FUNCTION public.sync_scheduled_email_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $fn$
DECLARE waiting boolean; armed boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.archive_emails WHERE status = 'scheduled') INTO waiting;
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-archive-emails') INTO armed;
  IF waiting AND NOT armed THEN
    PERFORM cron.schedule('scheduled-archive-emails', '*/5 * * * *', $job$
      SELECT net.http_post(
        url := 'https://letter-loom-archive.lovable.app/api/public/scheduled-emails',
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

DROP TRIGGER IF EXISTS archive_emails_sync_schedule ON public.archive_emails;
CREATE TRIGGER archive_emails_sync_schedule
AFTER INSERT OR UPDATE OF status OR DELETE ON public.archive_emails
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_scheduled_email_job();