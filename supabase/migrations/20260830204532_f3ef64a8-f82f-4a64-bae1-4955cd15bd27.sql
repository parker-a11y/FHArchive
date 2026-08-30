CREATE OR REPLACE FUNCTION public.find_person_matches(_name text, _limit integer DEFAULT 5)
RETURNS TABLE(id uuid, name text, matched_on text, score real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
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
     WHERE p.owner_id = auth.uid()
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