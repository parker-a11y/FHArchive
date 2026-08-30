DO $$
DECLARE
  r record;
  author_id uuid;
  recipient_id uuid;
  matches int;
BEGIN
  -- Backfill author links
  FOR r IN
    SELECT l.id AS letter_id, l.owner_id, l.author
    FROM public.letters l
    WHERE l.author IS NOT NULL AND length(trim(l.author)) > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.letter_people lp
        WHERE lp.letter_id = l.id AND lp.role = 'author'
      )
  LOOP
    SELECT count(*) INTO matches
    FROM public.people p
    WHERE p.owner_id = r.owner_id
      AND lower(trim(p.name)) = lower(trim(r.author));

    IF matches = 1 THEN
      SELECT p.id INTO author_id
      FROM public.people p
      WHERE p.owner_id = r.owner_id
        AND lower(trim(p.name)) = lower(trim(r.author))
      LIMIT 1;
    ELSE
      SELECT count(*) INTO matches
      FROM public.person_aliases a
      JOIN public.people p ON p.id = a.person_id
      WHERE a.owner_id = r.owner_id
        AND lower(trim(a.alias)) = lower(trim(r.author));

      IF matches = 1 THEN
        SELECT p.id INTO author_id
        FROM public.person_aliases a
        JOIN public.people p ON p.id = a.person_id
        WHERE a.owner_id = r.owner_id
          AND lower(trim(a.alias)) = lower(trim(r.author))
        LIMIT 1;
      END IF;
    END IF;

    IF author_id IS NOT NULL THEN
      INSERT INTO public.letter_people (owner_id, letter_id, person_id, role, source)
      VALUES (r.owner_id, r.letter_id, author_id, 'author', 'backfill')
      ON CONFLICT DO NOTHING;
      author_id := NULL;
    END IF;
  END LOOP;

  -- Backfill recipient links
  FOR r IN
    SELECT l.id AS letter_id, l.owner_id, l.recipient
    FROM public.letters l
    WHERE l.recipient IS NOT NULL AND length(trim(l.recipient)) > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.letter_people lp
        WHERE lp.letter_id = l.id AND lp.role = 'recipient'
      )
  LOOP
    SELECT count(*) INTO matches
    FROM public.people p
    WHERE p.owner_id = r.owner_id
      AND lower(trim(p.name)) = lower(trim(r.recipient));

    IF matches = 1 THEN
      SELECT p.id INTO recipient_id
      FROM public.people p
      WHERE p.owner_id = r.owner_id
        AND lower(trim(p.name)) = lower(trim(r.recipient))
      LIMIT 1;
    ELSE
      SELECT count(*) INTO matches
      FROM public.person_aliases a
      JOIN public.people p ON p.id = a.person_id
      WHERE a.owner_id = r.owner_id
        AND lower(trim(a.alias)) = lower(trim(r.recipient));

      IF matches = 1 THEN
        SELECT p.id INTO recipient_id
        FROM public.person_aliases a
        JOIN public.people p ON p.id = a.person_id
        WHERE a.owner_id = r.owner_id
          AND lower(trim(a.alias)) = lower(trim(r.recipient))
        LIMIT 1;
      END IF;
    END IF;

    IF recipient_id IS NOT NULL THEN
      INSERT INTO public.letter_people (owner_id, letter_id, person_id, role, source)
      VALUES (r.owner_id, r.letter_id, recipient_id, 'recipient', 'backfill')
      ON CONFLICT DO NOTHING;
      recipient_id := NULL;
    END IF;
  END LOOP;
END $$;