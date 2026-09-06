CREATE TABLE public.archive_id_retirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fh_seq integer NOT NULL,
  archive_id text NOT NULL UNIQUE,
  reason text NOT NULL,
  retired_by uuid,
  retired_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_id_retirements TO authenticated;
GRANT ALL ON public.archive_id_retirements TO service_role;

ALTER TABLE public.archive_id_retirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved users read retirements"
  ON public.archive_id_retirements FOR SELECT TO authenticated
  USING (public.can_read_archive(auth.uid()));

CREATE POLICY "admins insert retirements"
  ON public.archive_id_retirements FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins update retirements"
  ON public.archive_id_retirements FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins delete retirements"
  ON public.archive_id_retirements FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_archive_id_retirements_updated_at
  BEFORE UPDATE ON public.archive_id_retirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.archive_id_retirements (fh_seq, archive_id, reason) VALUES
  (48, 'FH0048', 'Duplicate record created by an intake error; deleted 2026-09-06. No archival material was lost.'),
  (49, 'FH0049', 'Duplicate record created by an intake error; deleted 2026-09-06. No archival material was lost.');
