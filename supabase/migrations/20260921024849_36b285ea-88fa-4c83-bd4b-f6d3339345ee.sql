CREATE TABLE public.date_context_queue (
  on_date date PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.date_context_queue TO authenticated;
GRANT ALL ON public.date_context_queue TO service_role;

ALTER TABLE public.date_context_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Archive readers can view the date queue"
ON public.date_context_queue FOR SELECT TO authenticated
USING (public.can_read_archive(auth.uid()) OR public.can_edit_archive(auth.uid()));

CREATE POLICY "Archive editors can add to the date queue"
ON public.date_context_queue FOR INSERT TO authenticated
WITH CHECK (public.can_edit_archive(auth.uid()));

CREATE POLICY "Archive editors can update the date queue"
ON public.date_context_queue FOR UPDATE TO authenticated
USING (public.can_edit_archive(auth.uid()))
WITH CHECK (public.can_edit_archive(auth.uid()));

CREATE POLICY "Archive editors can remove from the date queue"
ON public.date_context_queue FOR DELETE TO authenticated
USING (public.can_edit_archive(auth.uid()));

CREATE INDEX date_context_queue_status_idx ON public.date_context_queue (status, on_date);

CREATE TRIGGER update_date_context_queue_updated_at
BEFORE UPDATE ON public.date_context_queue
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.date_context_queue (on_date)
SELECT d.dt FROM (
  SELECT DISTINCT normalized_date AS dt FROM public.letters WHERE normalized_date IS NOT NULL
  UNION
  SELECT DISTINCT normalized_date FROM public.digital_sources WHERE normalized_date IS NOT NULL
) d
LEFT JOIN public.date_contexts c ON c.on_date = d.dt
WHERE c.id IS NULL
ON CONFLICT (on_date) DO NOTHING;

INSERT INTO public.job_config (key, value)
VALUES ('on_this_date_backfill', 'running')
ON CONFLICT (key) DO NOTHING;
