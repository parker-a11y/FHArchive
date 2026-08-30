CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.person_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_norm text GENERATED ALWAYS AS (lower(regexp_replace(alias, '[^a-zA-Z0-9]+', '', 'g'))) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS person_aliases_owner_norm_key
  ON public.person_aliases (owner_id, alias_norm);
CREATE INDEX IF NOT EXISTS person_aliases_person_idx ON public.person_aliases (person_id);
CREATE INDEX IF NOT EXISTS people_name_trgm_idx ON public.people USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS person_aliases_alias_trgm_idx ON public.person_aliases USING gin (alias gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_aliases TO authenticated;
GRANT ALL ON public.person_aliases TO service_role;

ALTER TABLE public.person_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own person aliases" ON public.person_aliases FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "approved users can read" ON public.person_aliases FOR SELECT
  USING (public.can_read_archive(auth.uid()));
CREATE POLICY "admin only insert" ON public.person_aliases FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin only update" ON public.person_aliases FOR UPDATE
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin only delete" ON public.person_aliases FOR DELETE
  USING (public.is_admin(auth.uid()));

-- seed aliases from existing free-text alternate_names
INSERT INTO public.person_aliases (owner_id, person_id, alias)
SELECT p.owner_id, p.id, trim(x)
FROM public.people p,
     LATERAL unnest(string_to_array(coalesce(p.alternate_names, ''), ',')) AS x
WHERE length(trim(x)) > 1
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.find_person_matches(_name text, _limit integer DEFAULT 5)
RETURNS TABLE(id uuid, name text, matched_on text, score real)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH target AS (
    SELECT lower(regexp_replace(coalesce(_name, ''), '[^a-zA-Z0-9]+', '', 'g')) AS n,
           lower(coalesce(_name, '')) AS raw
  ),
  cands AS (
    SELECT p.id, p.name, p.name AS matched_on,
           GREATEST(
             similarity(lower(p.name), (SELECT raw FROM target)),
             CASE WHEN lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', '', 'g')) = (SELECT n FROM target)
                  THEN 1.0 ELSE 0 END
           )::real AS score
      FROM public.people p
     WHERE p.owner_id = auth.uid()
    UNION ALL
    SELECT p.id, p.name, a.alias AS matched_on,
           GREATEST(
             similarity(lower(a.alias), (SELECT raw FROM target)),
             CASE WHEN a.alias_norm = (SELECT n FROM target) THEN 1.0 ELSE 0 END
           )::real AS score
      FROM public.person_aliases a
      JOIN public.people p ON p.id = a.person_id
     WHERE a.owner_id = auth.uid()
  ),
  best AS (
    SELECT DISTINCT ON (c.id) c.id, c.name, c.matched_on, c.score
      FROM cands c
     ORDER BY c.id, c.score DESC
  )
  SELECT b.id, b.name, b.matched_on, b.score
    FROM best b
   WHERE b.score >= 0.3
   ORDER BY b.score DESC
   LIMIT COALESCE(_limit, 5);
$$;

CREATE OR REPLACE FUNCTION public.merge_people(_target_id uuid, _source_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  target_name text;
  src record;
BEGIN
  PERFORM public.require_admin();
  SELECT name INTO target_name FROM public.people WHERE id = _target_id AND owner_id = uid;
  IF target_name IS NULL THEN RAISE EXCEPTION 'target person not found'; END IF;

  FOR src IN
    SELECT id, name FROM public.people
     WHERE id = ANY(_source_ids) AND id <> _target_id AND owner_id = uid
  LOOP
    -- keep the duplicate spelling as an alias
    INSERT INTO public.person_aliases (owner_id, person_id, alias)
    VALUES (uid, _target_id, src.name)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.person_aliases (owner_id, person_id, alias)
    SELECT uid, _target_id, a.alias FROM public.person_aliases a WHERE a.person_id = src.id
    ON CONFLICT DO NOTHING;

    -- repoint links, skipping ones that would duplicate
    UPDATE public.letter_people lp SET person_id = _target_id
     WHERE lp.person_id = src.id
       AND NOT EXISTS (
         SELECT 1 FROM public.letter_people x
          WHERE x.letter_id = lp.letter_id AND x.person_id = _target_id AND x.role = lp.role
       );
    DELETE FROM public.letter_people WHERE person_id = src.id;

    UPDATE public.ds_people dp SET person_id = _target_id
     WHERE dp.person_id = src.id
       AND NOT EXISTS (
         SELECT 1 FROM public.ds_people x
          WHERE x.source_id = dp.source_id AND x.person_id = _target_id AND x.role = dp.role
       );
    DELETE FROM public.ds_people WHERE person_id = src.id;

    -- free-text name fields on records
    UPDATE public.letters SET author = target_name WHERE owner_id = uid AND author = src.name;
    UPDATE public.letters SET recipient = target_name WHERE owner_id = uid AND recipient = src.name;
    UPDATE public.letters SET primary_person = target_name WHERE owner_id = uid AND primary_person = src.name;

    INSERT INTO public.edit_history (owner_id, entity, field_key, old_value, new_value)
    VALUES (uid, 'people', 'merge', src.name, target_name);

    DELETE FROM public.people WHERE id = src.id;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.find_person_matches(text, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.merge_people(uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_person_matches(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid[]) TO authenticated;