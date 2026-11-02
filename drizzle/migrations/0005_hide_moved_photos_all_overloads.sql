DO $$
DECLARE r record; d text;
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p WHERE p.proname = 'search_letters' AND p.pronamespace = 'public'::regnamespace LOOP
    d := pg_get_functiondef(r.oid);
    IF position('moved_to_gallery' in d) = 0 THEN
      d := replace(d, $q$|| ' WHERE ($1 IS NULL OR l.record_type = $1)'$q$, $q$|| ' WHERE l.record_type <> ''moved_to_gallery'' AND ($1 IS NULL OR l.record_type = $1)'$q$);
      EXECUTE d;
    END IF;
  END LOOP;
END $$;