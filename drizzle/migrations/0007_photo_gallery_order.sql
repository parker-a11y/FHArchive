ALTER TABLE public.photos ADD COLUMN sort_order bigint;
WITH ranked AS (SELECT id, row_number() OVER (ORDER BY created_at DESC, id) AS position FROM public.photos)
UPDATE public.photos p SET sort_order = ranked.position FROM ranked WHERE p.id = ranked.id;
CREATE INDEX photos_sort_idx ON public.photos (sort_order, created_at DESC, id);
CREATE OR REPLACE FUNCTION public.reorder_photos(ordered_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.can_edit_archive(auth.uid()) THEN RAISE EXCEPTION 'Photo editing permission required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('photo_gallery_order'));
  IF cardinality(ordered_ids) IS NULL
     OR cardinality(ordered_ids) <> (SELECT count(DISTINCT id) FROM unnest(ordered_ids) AS ids(id))
     OR cardinality(ordered_ids) <> (SELECT count(*) FROM public.photos)
     OR cardinality(ordered_ids) <> (SELECT count(*) FROM public.photos WHERE id = ANY(ordered_ids)) THEN
    RAISE EXCEPTION 'The gallery changed. Refresh and try again.';
  END IF;
  UPDATE public.photos p SET sort_order = ordered.position
  FROM unnest(ordered_ids) WITH ORDINALITY AS ordered(id, position)
  WHERE p.id = ordered.id;
END;
$$;
REVOKE ALL ON FUNCTION public.reorder_photos(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_photos(uuid[]) TO authenticated;