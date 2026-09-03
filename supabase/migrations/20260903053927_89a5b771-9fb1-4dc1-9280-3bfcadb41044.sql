-- storage.objects: allow editors (admin or approved archivist) to add/update archive files
DROP POLICY IF EXISTS "admin only file insert" ON storage.objects;
DROP POLICY IF EXISTS "admin only file update" ON storage.objects;

CREATE POLICY "editors only file insert" ON storage.objects
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id <> ALL (ARRAY['scans','ds-files','container-photos'])
  OR public.can_edit_archive(auth.uid())
);

CREATE POLICY "editors only file update" ON storage.objects
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  bucket_id <> ALL (ARRAY['scans','ds-files','container-photos'])
  OR public.can_edit_archive(auth.uid())
);

-- digital_files / file_derivatives: allow editors to insert and update
DROP POLICY IF EXISTS "admin only insert" ON public.digital_files;
DROP POLICY IF EXISTS "admin only update" ON public.digital_files;
DROP POLICY IF EXISTS "admin only insert" ON public.file_derivatives;
DROP POLICY IF EXISTS "admin only update" ON public.file_derivatives;

CREATE POLICY "editors only insert" ON public.digital_files
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.can_edit_archive(auth.uid()));

CREATE POLICY "editors only update" ON public.digital_files
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.can_edit_archive(auth.uid()))
WITH CHECK (public.can_edit_archive(auth.uid()));

CREATE POLICY "editors only insert" ON public.file_derivatives
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.can_edit_archive(auth.uid()));

CREATE POLICY "editors only update" ON public.file_derivatives
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.can_edit_archive(auth.uid()))
WITH CHECK (public.can_edit_archive(auth.uid()));

-- archivists need a permissive insert path for digital_files too
DROP POLICY IF EXISTS "archivists insert" ON public.digital_files;
CREATE POLICY "archivists insert" ON public.digital_files
FOR INSERT TO authenticated
WITH CHECK (public.is_approved_archivist(auth.uid()));

-- archivists need permissive storage insert/update for scans and container photos
DROP POLICY IF EXISTS "archivists upload archive files" ON storage.objects;
CREATE POLICY "archivists upload archive files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = ANY (ARRAY['scans','ds-files','container-photos'])
  AND public.is_approved_archivist(auth.uid())
);

DROP POLICY IF EXISTS "archivists update archive files" ON storage.objects;
CREATE POLICY "archivists update archive files" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = ANY (ARRAY['scans','ds-files','container-photos'])
  AND public.is_approved_archivist(auth.uid())
)
WITH CHECK (
  bucket_id = ANY (ARRAY['scans','ds-files','container-photos'])
  AND public.is_approved_archivist(auth.uid())
);