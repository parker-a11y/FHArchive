DROP POLICY IF EXISTS "Signed-in users can view backup runs" ON public.backup_runs;
CREATE POLICY "Archive editors can view backup runs"
ON public.backup_runs
FOR SELECT
TO authenticated
USING (public.can_edit_archive(auth.uid()));

DROP POLICY IF EXISTS "Signed-in users can view backed up files" ON public.backup_files;
CREATE POLICY "Archive editors can view backed up files"
ON public.backup_files
FOR SELECT
TO authenticated
USING (public.can_edit_archive(auth.uid()));