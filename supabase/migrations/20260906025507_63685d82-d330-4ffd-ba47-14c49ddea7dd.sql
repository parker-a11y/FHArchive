DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'letters','digital_files','file_derivatives','scan_transcriptions','edit_history','ai_suggestions',
    'digital_sources','ds_events','ds_files','ds_keywords','ds_organizations','ds_people','ds_places','ds_segments',
    'source_containers','container_files',
    'people','person_aliases','places','organizations','events','keywords','tone_options','record_categories',
    'letter_events','letter_keywords','letter_organizations','letter_people','letter_places','letter_relations','letter_sources',
    'record_links','historical_references','historical_claims','archive_notes','weekly_recaps',
    'record_shares','source_shares','rejected_entities'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR p IN
      SELECT pol.polname
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND pol.polcmd IN ('a','w','d')
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.polname, t);
    END LOOP;

    EXECUTE format($f$CREATE POLICY "editors insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_edit_archive(auth.uid()))$f$, t);
    EXECUTE format($f$CREATE POLICY "editors update" ON public.%I FOR UPDATE TO authenticated USING (public.can_edit_archive(auth.uid())) WITH CHECK (public.can_edit_archive(auth.uid()))$f$, t);
    EXECUTE format($f$CREATE POLICY "admins delete" ON public.%I FOR DELETE TO authenticated USING (public.is_admin(auth.uid()))$f$, t);

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "archivists upload ds-files" ON storage.objects;
DROP POLICY IF EXISTS "archivists update ds-files" ON storage.objects;
DROP POLICY IF EXISTS "archivists upload archive files" ON storage.objects;
DROP POLICY IF EXISTS "archivists update archive files" ON storage.objects;
DROP POLICY IF EXISTS "editors only file insert" ON storage.objects;
DROP POLICY IF EXISTS "editors only file update" ON storage.objects;
DROP POLICY IF EXISTS "admin only file delete" ON storage.objects;

CREATE POLICY "editors upload archive files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = ANY (ARRAY['scans','ds-files','container-photos']) AND public.can_edit_archive(auth.uid()));

CREATE POLICY "editors update archive files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = ANY (ARRAY['scans','ds-files','container-photos']) AND public.can_edit_archive(auth.uid()))
WITH CHECK (bucket_id = ANY (ARRAY['scans','ds-files','container-photos']) AND public.can_edit_archive(auth.uid()));

CREATE POLICY "editors delete archive files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = ANY (ARRAY['scans','ds-files','container-photos']) AND public.can_edit_archive(auth.uid()));