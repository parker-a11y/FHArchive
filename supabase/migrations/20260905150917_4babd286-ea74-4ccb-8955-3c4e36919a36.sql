CREATE TABLE public.date_contexts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  on_date date NOT NULL UNIQUE,
  narrative_md text NOT NULL DEFAULT '',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  manually_edited boolean NOT NULL DEFAULT false,
  regenerated_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamp with time zone,
  last_edited_at timestamp with time zone,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.date_contexts TO authenticated;
GRANT ALL ON public.date_contexts TO service_role;

ALTER TABLE public.date_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Archive readers can view historical context"
ON public.date_contexts FOR SELECT TO authenticated
USING (public.can_read_archive(auth.uid()));

CREATE INDEX date_contexts_generated_at_idx ON public.date_contexts (generated_at DESC);
CREATE INDEX date_contexts_last_viewed_idx ON public.date_contexts (last_viewed_at DESC NULLS LAST);

CREATE TRIGGER date_contexts_set_updated_at
BEFORE UPDATE ON public.date_contexts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();