DROP POLICY IF EXISTS "admin only insert" ON public.record_links;
DROP POLICY IF EXISTS "admin only update" ON public.record_links;
DROP POLICY IF EXISTS "archivists insert" ON public.record_links;
DROP POLICY IF EXISTS "archivists update" ON public.record_links;
DROP POLICY IF EXISTS "editors insert" ON public.record_links;
DROP POLICY IF EXISTS "editors update" ON public.record_links;

CREATE POLICY "editors insert" ON public.record_links
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_archive(auth.uid()));

CREATE POLICY "editors update" ON public.record_links
FOR UPDATE TO authenticated
USING (public.can_edit_archive(auth.uid()))
WITH CHECK (public.can_edit_archive(auth.uid()));