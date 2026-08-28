-- 1. Expand letters (archive items)
ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'letter',
  ADD COLUMN IF NOT EXISTS subtype text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS date_end date,
  ADD COLUMN IF NOT EXISTS primary_person text,
  ADD COLUMN IF NOT EXISTS physical_description text,
  ADD COLUMN IF NOT EXISTS original_copy text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS storage_location text,
  ADD COLUMN IF NOT EXISTS provenance text,
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS digitization_notes text,
  ADD COLUMN IF NOT EXISTS research_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS research_notes text,
  ADD COLUMN IF NOT EXISTS citations text,
  ADD COLUMN IF NOT EXISTS historical_notes text;

CREATE INDEX IF NOT EXISTS letters_record_type_idx ON public.letters (owner_id, record_type);

-- 2. Organizations / ships / units
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  org_type text NOT NULL DEFAULT 'other',
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own organizations" ON public.organizations;
CREATE POLICY "own organizations" ON public.organizations FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP TRIGGER IF EXISTS organizations_updated ON public.organizations;
CREATE TRIGGER organizations_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.letter_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'mentioned',
  source text NOT NULL DEFAULT 'human',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_organizations TO authenticated;
GRANT ALL ON public.letter_organizations TO service_role;
ALTER TABLE public.letter_organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own letter_organizations" ON public.letter_organizations;
CREATE POLICY "own letter_organizations" ON public.letter_organizations FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 3. Events
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  event_type text NOT NULL DEFAULT 'other',
  start_date date,
  end_date date,
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own events" ON public.events;
CREATE POLICY "own events" ON public.events FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP TRIGGER IF EXISTS events_updated ON public.events;
CREATE TRIGGER events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.letter_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'human',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_events TO authenticated;
GRANT ALL ON public.letter_events TO service_role;
ALTER TABLE public.letter_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own letter_events" ON public.letter_events;
CREATE POLICY "own letter_events" ON public.letter_events FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 4. Seed core people + ship for existing accounts
INSERT INTO public.people (owner_id, name, relationship)
SELECT u.id, v.name, v.rel
FROM auth.users u
CROSS JOIN (VALUES
  ('Francis A. Harrington', 'Principal subject'),
  ('Jacqueline Harrington', 'Principal subject')
) AS v(name, rel)
WHERE NOT EXISTS (
  SELECT 1 FROM public.people p WHERE p.owner_id = u.id AND lower(p.name) = lower(v.name)
);

INSERT INTO public.organizations (owner_id, name, org_type, description)
SELECT u.id, 'USS Doyle C. Barnes (DE-353)', 'ship',
       'John C. Butler-class destroyer escort; Francis A. Harrington served aboard during World War II.'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations o
  WHERE o.owner_id = u.id AND lower(o.name) = lower('USS Doyle C. Barnes (DE-353)')
);

-- 5. Create-record function (supersedes create_letter, which is left intact)
CREATE OR REPLACE FUNCTION public.create_record(
  p_record_type text,
  p_subtype text,
  p_title text,
  p_date_as_written text,
  p_normalized_date date,
  p_date_end date,
  p_date_precision text,
  p_date_certainty text,
  p_primary_person text,
  p_author text,
  p_recipient text,
  p_origin text,
  p_destination text,
  p_period text,
  p_sheets integer,
  p_has_envelope boolean,
  p_has_enclosures boolean,
  p_storage_location text,
  p_original_copy text,
  p_notes text
)
RETURNS TABLE(id uuid, fh_seq integer, archive_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  n integer;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.archive_counter (owner_id, last_seq)
  VALUES (uid, 1)
  ON CONFLICT (owner_id) DO UPDATE SET last_seq = public.archive_counter.last_seq + 1
  RETURNING last_seq INTO n;

  INSERT INTO public.letters (
    owner_id, fh_seq, archive_id, record_type, subtype, title,
    date_as_written, normalized_date, date_end, date_precision, date_certainty,
    primary_person, author, recipient, origin, destination, period, sheets,
    has_envelope, has_enclosures, storage_location, original_copy, notes
  ) VALUES (
    uid, n, 'FH' || lpad(n::text, 4, '0'),
    COALESCE(p_record_type, 'letter'), p_subtype, p_title,
    p_date_as_written, p_normalized_date, p_date_end,
    COALESCE(p_date_precision, 'unknown'), COALESCE(p_date_certainty, 'unknown'),
    p_primary_person, p_author, p_recipient, p_origin, p_destination,
    COALESCE(p_period, 'unknown'), p_sheets,
    COALESCE(p_has_envelope, false), COALESCE(p_has_enclosures, false),
    p_storage_location, COALESCE(p_original_copy, 'unknown'), p_notes
  ) RETURNING letters.id INTO new_id;

  RETURN QUERY SELECT new_id, n, 'FH' || lpad(n::text, 4, '0');
END;
$function$;

REVOKE ALL ON FUNCTION public.create_record(text,text,text,text,date,date,text,text,text,text,text,text,text,text,integer,boolean,boolean,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_record(text,text,text,text,date,date,text,text,text,text,text,text,text,text,integer,boolean,boolean,text,text,text) TO authenticated;