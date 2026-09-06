CREATE OR REPLACE FUNCTION public.preview_next_archive_id()
RETURNS TABLE(fh_seq integer, archive_id text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner uuid;
BEGIN
  PERFORM public.require_editor();
  owner := public.archive_owner_id();

  RETURN QUERY
  SELECT c.last_seq + 1, 'FH' || lpad((c.last_seq + 1)::text, 4, '0')
  FROM public.archive_counter c
  WHERE c.owner_id = owner
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_next_archive_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_next_archive_id() TO authenticated, service_role;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['letters', 'letter_people', 'letter_places']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin only insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin only update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "archivists insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "archivists update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "editors insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "editors update" ON public.%I', t);
    EXECUTE format('CREATE POLICY "editors insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_edit_archive(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "editors update" ON public.%I FOR UPDATE TO authenticated USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()))', t);
  END LOOP;
END;
$$;