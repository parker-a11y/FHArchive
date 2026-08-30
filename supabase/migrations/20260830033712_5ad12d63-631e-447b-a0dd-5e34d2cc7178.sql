CREATE OR REPLACE FUNCTION public.merge_places(_target_id uuid, _source_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  target_name text;
  src record;
BEGIN
  PERFORM public.require_admin();
  SELECT canonical_name INTO target_name FROM public.places WHERE id = _target_id AND owner_id = uid;
  IF target_name IS NULL THEN RAISE EXCEPTION 'target place not found'; END IF;

  FOR src IN
    SELECT id, canonical_name FROM public.places
     WHERE id = ANY(_source_ids) AND id <> _target_id AND owner_id = uid
  LOOP
    UPDATE public.letter_places lp SET place_id = _target_id
     WHERE lp.place_id = src.id
       AND NOT EXISTS (
         SELECT 1 FROM public.letter_places x
          WHERE x.letter_id = lp.letter_id AND x.place_id = _target_id AND x.role = lp.role
       );
    DELETE FROM public.letter_places WHERE place_id = src.id;

    UPDATE public.ds_places dp SET place_id = _target_id
     WHERE dp.place_id = src.id
       AND NOT EXISTS (
         SELECT 1 FROM public.ds_places x
          WHERE x.source_id = dp.source_id AND x.place_id = _target_id AND x.role = dp.role
       );
    DELETE FROM public.ds_places WHERE place_id = src.id;

    UPDATE public.letters SET origin = target_name WHERE owner_id = uid AND origin = src.canonical_name;
    UPDATE public.letters SET destination = target_name WHERE owner_id = uid AND destination = src.canonical_name;

    INSERT INTO public.edit_history (owner_id, entity, field_key, old_value, new_value)
    VALUES (uid, 'places', 'merge', src.canonical_name, target_name);

    DELETE FROM public.places WHERE id = src.id;
  END LOOP;
END $function$;

REVOKE ALL ON FUNCTION public.merge_places(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_places(uuid, uuid[]) TO authenticated;