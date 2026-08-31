-- Helpers -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_approved_archivist(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = _user_id AND r.role = 'archivist' AND p.status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_archive(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id)
      OR public.is_approved_guest(_user_id)
      OR public.is_approved_archivist(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_edit_archive(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id) OR public.is_approved_archivist(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.require_editor()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.can_edit_archive(auth.uid()) THEN RAISE EXCEPTION 'forbidden: read-only account'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.archive_owner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved_archivist(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_archive(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.require_editor() FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_owner_id() FROM anon;

-- Owner stamping for archivist inserts --------------------------------
CREATE OR REPLACE FUNCTION public.stamp_archive_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_approved_archivist(auth.uid()) THEN
    NEW.owner_id := COALESCE(public.archive_owner_id(), NEW.owner_id);
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
  write_tables text[] := ARRAY[
    'scan_transcriptions','ai_suggestions','file_derivatives','keywords','letter_keywords',
    'people','person_aliases','places','organizations','events',
    'letter_people','letter_places','letter_organizations','letter_events',
    'letter_relations','letter_sources','historical_references',
    'digital_sources','ds_files','ds_people','ds_places','ds_organizations','ds_events',
    'ds_keywords','ds_segments','record_categories','tone_options','edit_history'
  ];
BEGIN
  FOREACH t IN ARRAY write_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS stamp_archive_owner ON public.%I', t);
    EXECUTE format('CREATE TRIGGER stamp_archive_owner BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_archive_owner()', t);
    EXECUTE format('DROP POLICY IF EXISTS "archivists insert" ON public.%I', t);
    EXECUTE format('CREATE POLICY "archivists insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_approved_archivist(auth.uid()))', t);
    EXECUTE format('DROP POLICY IF EXISTS "archivists update" ON public.%I', t);
    EXECUTE format('CREATE POLICY "archivists update" ON public.%I FOR UPDATE TO authenticated USING (public.is_approved_archivist(auth.uid())) WITH CHECK (public.is_approved_archivist(auth.uid()))', t);
  END LOOP;
END $$;

-- Update-only tables: archivists may edit but not create or remove
DROP POLICY IF EXISTS "archivists update" ON public.letters;
CREATE POLICY "archivists update" ON public.letters FOR UPDATE TO authenticated
  USING (public.is_approved_archivist(auth.uid())) WITH CHECK (public.is_approved_archivist(auth.uid()));

DROP POLICY IF EXISTS "archivists update" ON public.digital_files;
CREATE POLICY "archivists update" ON public.digital_files FOR UPDATE TO authenticated
  USING (public.is_approved_archivist(auth.uid())) WITH CHECK (public.is_approved_archivist(auth.uid()));

-- Digital source creation RPC becomes editor-accessible ---------------
CREATE OR REPLACE FUNCTION public.create_digital_source(p_title text, p_source_type text, p_creator text, p_institution text, p_original_date text, p_date_accessed date, p_historical_date_range text, p_url text, p_description text, p_notes text, p_normalized_date date DEFAULT NULL::date, p_date_precision text DEFAULT 'unknown'::text)
 RETURNS TABLE(id uuid, ds_seq integer, ds_id text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_seq integer; v_id uuid; v_dsid text; v_owner uuid;
BEGIN
  PERFORM public.require_editor();
  v_owner := COALESCE(public.archive_owner_id(), auth.uid());
  INSERT INTO public.ds_counter (owner_id, last_seq) VALUES (v_owner, 1)
  ON CONFLICT (owner_id) DO UPDATE SET last_seq = ds_counter.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO v_seq;
  v_dsid := 'DS-' || lpad(v_seq::text, 4, '0');
  INSERT INTO public.digital_sources (
    owner_id, ds_seq, ds_id, title, source_type, creator, institution,
    original_date, date_accessed, historical_date_range, url, description, notes,
    normalized_date, date_precision
  ) VALUES (
    v_owner, v_seq, v_dsid, p_title, p_source_type, p_creator, p_institution,
    p_original_date, p_date_accessed, p_historical_date_range, p_url, p_description, p_notes,
    p_normalized_date, COALESCE(p_date_precision, 'unknown')
  ) RETURNING digital_sources.id INTO v_id;
  RETURN QUERY SELECT v_id, v_seq, v_dsid;
END $function$;

CREATE OR REPLACE FUNCTION public.preview_next_ds_id()
 RETURNS TABLE(ds_seq integer, ds_id text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_seq integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT c.last_seq + 1 INTO v_seq FROM public.ds_counter c
   WHERE c.owner_id = COALESCE(public.archive_owner_id(), auth.uid());
  v_seq := COALESCE(v_seq, 1);
  RETURN QUERY SELECT v_seq, 'DS-' || lpad(v_seq::text, 4, '0');
END $function$;

CREATE OR REPLACE FUNCTION public.find_person_matches(_name text, _limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, name text, matched_on text, score real)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH owner AS (SELECT COALESCE(public.archive_owner_id(), auth.uid()) AS oid),
  target AS (
    SELECT lower(regexp_replace(coalesce(_name, ''), '[^a-zA-Z0-9]+', '', 'g')) AS n,
           lower(coalesce(_name, '')) AS raw
  ),
  cands AS (
    SELECT p.id, p.name, p.name AS matched_on,
           GREATEST(
             similarity(lower(p.name), (SELECT raw FROM target)),
             CASE WHEN length((SELECT raw FROM target)) >= 2
                  THEN word_similarity((SELECT raw FROM target), lower(p.name)) ELSE 0 END,
             CASE WHEN length((SELECT n FROM target)) >= 3
                   AND lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', '', 'g')) LIKE (SELECT n FROM target) || '%'
                  THEN 0.75 ELSE 0 END,
             CASE WHEN lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', '', 'g')) = (SELECT n FROM target)
                  THEN 1.0 ELSE 0 END
           )::real AS score
      FROM public.people p
     WHERE p.owner_id = (SELECT oid FROM owner)
    UNION ALL
    SELECT p.id, p.name, a.alias AS matched_on,
           GREATEST(
             similarity(lower(a.alias), (SELECT raw FROM target)),
             CASE WHEN length((SELECT raw FROM target)) >= 2
                  THEN word_similarity((SELECT raw FROM target), lower(a.alias)) ELSE 0 END,
             CASE WHEN length((SELECT n FROM target)) >= 3
                   AND a.alias_norm LIKE (SELECT n FROM target) || '%'
                  THEN 0.75 ELSE 0 END,
             CASE WHEN a.alias_norm = (SELECT n FROM target) THEN 1.0 ELSE 0 END
           )::real AS score
      FROM public.person_aliases a
      JOIN public.people p ON p.id = a.person_id
     WHERE a.owner_id = (SELECT oid FROM owner)
  ),
  best AS (
    SELECT DISTINCT ON (c.id) c.id, c.name, c.matched_on, c.score
      FROM cands c ORDER BY c.id, c.score DESC
  )
  SELECT b.id, b.name, b.matched_on, b.score
    FROM best b WHERE b.score >= 0.3
   ORDER BY b.score DESC LIMIT COALESCE(_limit, 5);
$function$;

-- Storage: archivists upload digital-source files ---------------------
DROP POLICY IF EXISTS "archivists upload ds-files" ON storage.objects;
CREATE POLICY "archivists upload ds-files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ds-files' AND public.is_approved_archivist(auth.uid()));

DROP POLICY IF EXISTS "archivists update ds-files" ON storage.objects;
CREATE POLICY "archivists update ds-files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ds-files' AND public.is_approved_archivist(auth.uid()));