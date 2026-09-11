-- 1. Filter/provenance columns on the meaning index
ALTER TABLE public.research_chunks
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS sort_date date,
  ADD COLUMN IF NOT EXISTS record_type text,
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS recipient text,
  ADD COLUMN IF NOT EXISTS people text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS places text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS organizations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS page_label text;

CREATE INDEX IF NOT EXISTS research_chunks_sort_date_idx ON public.research_chunks (sort_date);
CREATE INDEX IF NOT EXISTS research_chunks_kind_idx ON public.research_chunks (kind);

-- 2. Allow the new index kinds (notes, people, places, organizations, archive notes)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conrelid::regclass::text AS tbl, conname
    FROM pg_constraint
    WHERE conrelid IN ('public.research_index'::regclass, 'public.research_chunks'::regclass)
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

-- 3. Meaning search with optional structured filters
DROP FUNCTION IF EXISTS public.match_research_chunks(vector, int);
CREATE OR REPLACE FUNCTION public.match_research_chunks(
  query_embedding vector(3072),
  match_count int DEFAULT 60,
  p_kinds text[] DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_author text DEFAULT NULL,
  p_recipient text DEFAULT NULL,
  p_record_types text[] DEFAULT NULL,
  p_person text DEFAULT NULL,
  p_place text DEFAULT NULL,
  p_org text DEFAULT NULL,
  p_keyword text DEFAULT NULL
)
RETURNS TABLE (
  kind text,
  archive_id text,
  chunk_index int,
  content text,
  page_label text,
  title text,
  sort_date date,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.kind,
    c.archive_id,
    c.chunk_index,
    c.content,
    c.page_label,
    c.title,
    c.sort_date,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.research_chunks c
  WHERE (p_kinds IS NULL OR c.kind = ANY (p_kinds))
    AND (p_date_from IS NULL OR (c.sort_date IS NOT NULL AND c.sort_date >= p_date_from))
    AND (p_date_to IS NULL OR (c.sort_date IS NOT NULL AND c.sort_date <= p_date_to))
    AND (p_author IS NULL OR c.author ILIKE '%' || p_author || '%')
    AND (p_recipient IS NULL OR c.recipient ILIKE '%' || p_recipient || '%')
    AND (p_record_types IS NULL OR c.record_type = ANY (p_record_types))
    AND (p_person IS NULL OR EXISTS (SELECT 1 FROM unnest(c.people) x WHERE x ILIKE '%' || p_person || '%'))
    AND (p_place IS NULL OR EXISTS (SELECT 1 FROM unnest(c.places) x WHERE x ILIKE '%' || p_place || '%'))
    AND (p_org IS NULL OR EXISTS (SELECT 1 FROM unnest(c.organizations) x WHERE x ILIKE '%' || p_org || '%'))
    AND (p_keyword IS NULL OR EXISTS (SELECT 1 FROM unnest(c.keywords) x WHERE x ILIKE '%' || p_keyword || '%'))
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_research_chunks(vector, int, text[], date, date, text, text, text[], text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_research_chunks(vector, int, text[], date, date, text, text, text[], text, text, text, text) TO authenticated, service_role;

-- 4. Incremental re-index queue
CREATE TABLE IF NOT EXISTS public.reindex_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  ref_id uuid NOT NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, ref_id)
);
GRANT SELECT ON public.reindex_queue TO authenticated;
GRANT ALL ON public.reindex_queue TO service_role;
ALTER TABLE public.reindex_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Archive readers can see the reindex queue" ON public.reindex_queue;
CREATE POLICY "Archive readers can see the reindex queue"
  ON public.reindex_queue FOR SELECT TO authenticated
  USING (public.can_read_archive(auth.uid()));

CREATE TABLE IF NOT EXISTS public.reindex_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  lease_until timestamptz,
  last_run_at timestamptz,
  last_result jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.reindex_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.reindex_state TO authenticated;
GRANT ALL ON public.reindex_state TO service_role;
ALTER TABLE public.reindex_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Archive readers can see the reindex state" ON public.reindex_state;
CREATE POLICY "Archive readers can see the reindex state"
  ON public.reindex_state FOR SELECT TO authenticated
  USING (public.can_read_archive(auth.uid()));

-- 5. Triggers that mark changed material for re-indexing
CREATE OR REPLACE FUNCTION public.mark_self_for_reindex()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.reindex_queue (source_table, ref_id)
  VALUES (TG_TABLE_NAME, COALESCE(NEW.id, OLD.id))
  ON CONFLICT (source_table, ref_id) DO UPDATE SET marked_at = now();
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.mark_letter_for_reindex()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.reindex_queue (source_table, ref_id)
  VALUES ('letters', COALESCE(NEW.letter_id, OLD.letter_id))
  ON CONFLICT (source_table, ref_id) DO UPDATE SET marked_at = now();
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS reindex_letters ON public.letters;
CREATE TRIGGER reindex_letters AFTER INSERT OR UPDATE OR DELETE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.mark_self_for_reindex();

DROP TRIGGER IF EXISTS reindex_scan_transcriptions ON public.scan_transcriptions;
CREATE TRIGGER reindex_scan_transcriptions AFTER INSERT OR UPDATE OR DELETE ON public.scan_transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.mark_letter_for_reindex();

DROP TRIGGER IF EXISTS reindex_digital_sources ON public.digital_sources;
CREATE TRIGGER reindex_digital_sources AFTER INSERT OR UPDATE OR DELETE ON public.digital_sources
  FOR EACH ROW EXECUTE FUNCTION public.mark_self_for_reindex();

DROP TRIGGER IF EXISTS reindex_ffn_notes ON public.ffn_notes;
CREATE TRIGGER reindex_ffn_notes AFTER INSERT OR UPDATE OR DELETE ON public.ffn_notes
  FOR EACH ROW EXECUTE FUNCTION public.mark_self_for_reindex();

DROP TRIGGER IF EXISTS reindex_people ON public.people;
CREATE TRIGGER reindex_people AFTER INSERT OR UPDATE OR DELETE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.mark_self_for_reindex();

DROP TRIGGER IF EXISTS reindex_places ON public.places;
CREATE TRIGGER reindex_places AFTER INSERT OR UPDATE OR DELETE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.mark_self_for_reindex();

DROP TRIGGER IF EXISTS reindex_organizations ON public.organizations;
CREATE TRIGGER reindex_organizations AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.mark_self_for_reindex();

DROP TRIGGER IF EXISTS reindex_archive_notes ON public.archive_notes;
CREATE TRIGGER reindex_archive_notes AFTER INSERT OR UPDATE OR DELETE ON public.archive_notes
  FOR EACH ROW EXECUTE FUNCTION public.mark_self_for_reindex();

-- 6. Snapshot runs record meaning-index results
ALTER TABLE public.research_snapshots
  ADD COLUMN IF NOT EXISTS chunks_indexed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunks_embedded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embed_error text;