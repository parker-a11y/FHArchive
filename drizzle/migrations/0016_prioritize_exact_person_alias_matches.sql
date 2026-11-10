CREATE OR REPLACE FUNCTION public.find_person_matches(_name text, _limit integer DEFAULT 5)
RETURNS TABLE(id uuid, name text, matched_on text, score real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH owner AS (SELECT COALESCE(public.archive_owner_id(), auth.uid()) AS oid),
  target AS (
    SELECT lower(regexp_replace(coalesce(_name, ''), '[^a-zA-Z0-9]+', '', 'g')) AS n,
           lower(coalesce(_name, '')) AS raw
  ),
  spellings AS (
    SELECT p.id, p.name, p.name AS matched_on,
           lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', '', 'g')) AS normalized
    FROM public.people p WHERE p.owner_id = (SELECT oid FROM owner)
    UNION ALL
    SELECT p.id, p.name, a.alias AS matched_on, a.alias_norm AS normalized
    FROM public.person_aliases a JOIN public.people p ON p.id = a.person_id
    WHERE a.owner_id = (SELECT oid FROM owner)
      AND p.owner_id = (SELECT oid FROM owner)
  ),
  cands AS (
    SELECT s.id, s.name, s.matched_on,
           (t.n <> '' AND s.normalized = t.n) AS exact_match,
           GREATEST(
             similarity(lower(s.matched_on), t.raw),
             CASE WHEN length(t.raw) >= 2 THEN word_similarity(t.raw, lower(s.matched_on)) ELSE 0 END,
             CASE WHEN length(t.n) >= 3 AND s.normalized LIKE t.n || '%' THEN 0.75 ELSE 0 END,
             CASE WHEN t.n <> '' AND s.normalized = t.n THEN 1.0 ELSE 0 END
           )::real AS score
    FROM spellings s CROSS JOIN target t
  ),
  best AS (
    SELECT DISTINCT ON (c.id) c.id, c.name, c.matched_on, c.score, c.exact_match
    FROM cands c
    ORDER BY c.id, c.exact_match DESC, c.score DESC, c.matched_on
  )
  SELECT b.id, b.name, b.matched_on, b.score
  FROM best b WHERE b.score >= 0.3
  ORDER BY b.exact_match DESC, b.score DESC, b.name, b.id
  LIMIT GREATEST(COALESCE(_limit, 5), 1);
$function$;
REVOKE ALL ON FUNCTION public.find_person_matches(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_person_matches(text,integer) TO authenticated, service_role;