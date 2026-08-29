CREATE POLICY "approved users read archive files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('scans','ds-files','container-photos') AND public.can_read_archive(auth.uid()));

CREATE POLICY "admin only file insert" ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id NOT IN ('scans','ds-files','container-photos') OR public.is_admin(auth.uid()));

CREATE POLICY "admin only file update" ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id NOT IN ('scans','ds-files','container-photos') OR public.is_admin(auth.uid()));

CREATE POLICY "admin only file delete" ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id NOT IN ('scans','ds-files','container-photos') OR public.is_admin(auth.uid()));