-- Ask Francis: research snapshots, research index, historical claims

CREATE TABLE public.research_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  trigger text NOT NULL DEFAULT 'manual',
  folder text,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  records_indexed integer NOT NULL DEFAULT 0,
  transcriptions_indexed integer NOT NULL DEFAULT 0,
  sources_indexed integer NOT NULL DEFAULT 0,
  people_count integer NOT NULL DEFAULT 0,
  places_count integer NOT NULL DEFAULT 0,
  bytes_written bigint NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.research_snapshots TO authenticated;
GRANT ALL ON public.research_snapshots TO service_role;
ALTER TABLE public.research_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Archive readers can view snapshots"
  ON public.research_snapshots FOR SELECT TO authenticated
  USING (public.can_read_archive(auth.uid()));

CREATE TRIGGER research_snapshots_updated_at
  BEFORE UPDATE ON public.research_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.research_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  ref_id uuid NOT NULL,
  archive_id text NOT NULL,
  title text,
  record_type text,
  subtype text,
  period text,
  sort_date date,
  date_text text,
  author text,
  recipient text,
  origin text,
  destination text,
  tones text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  people text[] NOT NULL DEFAULT '{}',
  places text[] NOT NULL DEFAULT '{}',
  events text[] NOT NULL DEFAULT '{}',
  organizations text[] NOT NULL DEFAULT '{}',
  linked_refs text[] NOT NULL DEFAULT '{}',
  summary text,
  body text,
  has_transcription boolean NOT NULL DEFAULT false,
  snapshot_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  fts tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(archive_id,'') || ' ' ||
      coalesce(title,'') || ' ' ||
      coalesce(author,'') || ' ' ||
      coalesce(recipient,'') || ' ' ||
      coalesce(origin,'') || ' ' ||
      coalesce(destination,'') || ' ' ||
      coalesce(summary,'') || ' ' ||
      coalesce(body,'')
    )
  ) STORED,
  UNIQUE (kind, ref_id)
);

GRANT SELECT ON public.research_index TO authenticated;
GRANT ALL ON public.research_index TO service_role;
ALTER TABLE public.research_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Archive readers can search the index"
  ON public.research_index FOR SELECT TO authenticated
  USING (public.can_read_archive(auth.uid()));

CREATE INDEX research_index_fts_idx ON public.research_index USING gin (fts);
CREATE INDEX research_index_trgm_idx ON public.research_index USING gin (body gin_trgm_ops);
CREATE INDEX research_index_sort_date_idx ON public.research_index (sort_date);
CREATE INDEX research_index_type_idx ON public.research_index (record_type);
CREATE INDEX research_index_people_idx ON public.research_index USING gin (people);
CREATE INDEX research_index_places_idx ON public.research_index USING gin (places);
CREATE INDEX research_index_keywords_idx ON public.research_index USING gin (keywords);
CREATE INDEX research_index_tones_idx ON public.research_index USING gin (tones);

CREATE TABLE public.historical_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT public.archive_owner_id(),
  claim text NOT NULL,
  confidence text NOT NULL DEFAULT 'possible',
  question text,
  reasoning text,
  evidence text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.historical_claims TO authenticated;
GRANT ALL ON public.historical_claims TO service_role;
ALTER TABLE public.historical_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Archive readers can view claims"
  ON public.historical_claims FOR SELECT TO authenticated
  USING (public.can_read_archive(auth.uid()));
CREATE POLICY "Editors can add claims"
  ON public.historical_claims FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "Editors can update claims"
  ON public.historical_claims FOR UPDATE TO authenticated
  USING (public.can_edit_archive(auth.uid()))
  WITH CHECK (public.can_edit_archive(auth.uid()));
CREATE POLICY "Admins can delete claims"
  ON public.historical_claims FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER historical_claims_updated_at
  BEFORE UPDATE ON public.historical_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ask_francis boolean NOT NULL DEFAULT false;