-- Drop leftover owner-only write policies (any signed-in user could insert rows they own)
DROP POLICY IF EXISTS "own ai" ON public.ai_suggestions;
DROP POLICY IF EXISTS "own counter" ON public.archive_counter;
DROP POLICY IF EXISTS "own container counter" ON public.container_counter;
DROP POLICY IF EXISTS "own container files" ON public.container_files;
DROP POLICY IF EXISTS "own digital files" ON public.digital_files;
DROP POLICY IF EXISTS "own sources" ON public.digital_sources;
DROP POLICY IF EXISTS "own ds counter" ON public.ds_counter;
DROP POLICY IF EXISTS "own ds_events" ON public.ds_events;
DROP POLICY IF EXISTS "Owners manage their ds files" ON public.ds_files;
DROP POLICY IF EXISTS "own ds_keywords" ON public.ds_keywords;
DROP POLICY IF EXISTS "own ds_organizations" ON public.ds_organizations;
DROP POLICY IF EXISTS "own ds_people" ON public.ds_people;
DROP POLICY IF EXISTS "own ds_places" ON public.ds_places;
DROP POLICY IF EXISTS "own segments" ON public.ds_segments;
DROP POLICY IF EXISTS "own events" ON public.events;
DROP POLICY IF EXISTS "own file derivatives" ON public.file_derivatives;
DROP POLICY IF EXISTS "own refs" ON public.historical_references;
DROP POLICY IF EXISTS "own keywords" ON public.keywords;
DROP POLICY IF EXISTS "own letter_events" ON public.letter_events;
DROP POLICY IF EXISTS "own letter_keywords" ON public.letter_keywords;
DROP POLICY IF EXISTS "own letter_organizations" ON public.letter_organizations;
DROP POLICY IF EXISTS "own letter_people" ON public.letter_people;
DROP POLICY IF EXISTS "own letter_places" ON public.letter_places;
DROP POLICY IF EXISTS "own relations" ON public.letter_relations;
DROP POLICY IF EXISTS "own letter_sources" ON public.letter_sources;
DROP POLICY IF EXISTS "own letters" ON public.letters;
DROP POLICY IF EXISTS "own organizations" ON public.organizations;
DROP POLICY IF EXISTS "own people" ON public.people;
DROP POLICY IF EXISTS "own person aliases" ON public.person_aliases;
DROP POLICY IF EXISTS "own places" ON public.places;
DROP POLICY IF EXISTS "Owners manage their categories" ON public.record_categories;
DROP POLICY IF EXISTS "own record_links" ON public.record_links;
DROP POLICY IF EXISTS "Owners manage their shares" ON public.record_shares;
DROP POLICY IF EXISTS "own scan transcriptions" ON public.scan_transcriptions;
DROP POLICY IF EXISTS "own source containers" ON public.source_containers;
DROP POLICY IF EXISTS "Owners manage their own source shares" ON public.source_shares;
DROP POLICY IF EXISTS "Owners manage their tone options" ON public.tone_options;
DROP POLICY IF EXISTS "own history write" ON public.edit_history;

-- Share links: editors create them, admins manage them
CREATE POLICY "editors manage record shares" ON public.record_shares
  FOR ALL TO authenticated
  USING (can_edit_archive(auth.uid()))
  WITH CHECK (can_edit_archive(auth.uid()));
CREATE POLICY "editors manage source shares" ON public.source_shares
  FOR ALL TO authenticated
  USING (can_edit_archive(auth.uid()))
  WITH CHECK (can_edit_archive(auth.uid()));

-- Storage: remove per-user upload/update/delete paths in the archive buckets
DROP POLICY IF EXISTS "own scan files" ON storage.objects;
DROP POLICY IF EXISTS "own container photo objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload ds-files objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners update ds-files objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete ds-files objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners read ds-files objects" ON storage.objects;