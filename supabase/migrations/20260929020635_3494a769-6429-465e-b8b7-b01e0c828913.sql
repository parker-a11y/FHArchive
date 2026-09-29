CREATE TABLE public.email_scratchpads (
  letter_id uuid PRIMARY KEY REFERENCES public.letters(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_scratchpads TO authenticated;
GRANT ALL ON public.email_scratchpads TO service_role;
ALTER TABLE public.email_scratchpads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email scratchpads" ON public.email_scratchpads FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE OR REPLACE FUNCTION public.touch_email_scratchpad() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER email_scratchpads_touch BEFORE UPDATE ON public.email_scratchpads FOR EACH ROW EXECUTE FUNCTION public.touch_email_scratchpad();