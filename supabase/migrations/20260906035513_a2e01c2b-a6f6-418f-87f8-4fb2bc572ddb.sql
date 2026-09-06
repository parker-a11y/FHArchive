-- Numbering & gaps: admins may read the counter
CREATE POLICY "admins read counter" ON public.archive_counter
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Francis File Notes -------------------------------------------------------
CREATE TABLE public.ffn_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  title text,
  expanded_name text,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'other',
  short_definition text,
  background text,
  archive_context text,
  sources text,
  status text NOT NULL DEFAULT 'draft',
  auto_link boolean NOT NULL DEFAULT true,
  appearance_count integer NOT NULL DEFAULT 0,
  appearances_updated_at timestamptz,
  ai_assisted boolean NOT NULL DEFAULT false,
  ai_generated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ffn_notes TO authenticated;
GRANT SELECT ON public.ffn_notes TO anon;
GRANT ALL ON public.ffn_notes TO service_role;
ALTER TABLE public.ffn_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published notes are public" ON public.ffn_notes
  FOR SELECT USING (status = 'published');
CREATE POLICY "archive members read all notes" ON public.ffn_notes
  FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "admins insert notes" ON public.ffn_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins update notes" ON public.ffn_notes
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins delete notes" ON public.ffn_notes
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER ffn_notes_updated_at BEFORE UPDATE ON public.ffn_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ffn_notes_status_idx ON public.ffn_notes (status);
CREATE INDEX ffn_notes_category_idx ON public.ffn_notes (category);

CREATE TABLE public.ffn_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.ffn_notes(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_norm text NOT NULL,
  auto_link boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, alias_norm)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ffn_aliases TO authenticated;
GRANT SELECT ON public.ffn_aliases TO anon;
GRANT ALL ON public.ffn_aliases TO service_role;
ALTER TABLE public.ffn_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aliases of published notes are public" ON public.ffn_aliases
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.ffn_notes n WHERE n.id = note_id AND n.status = 'published'));
CREATE POLICY "archive members read aliases" ON public.ffn_aliases
  FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "admins write aliases" ON public.ffn_aliases
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX ffn_aliases_norm_idx ON public.ffn_aliases (alias_norm);

CREATE TABLE public.ffn_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.ffn_notes(id) ON DELETE CASCADE,
  image_url text,
  storage_bucket text,
  storage_path text,
  caption text,
  credit text,
  rights_note text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ffn_images TO authenticated;
GRANT SELECT ON public.ffn_images TO anon;
GRANT ALL ON public.ffn_images TO service_role;
ALTER TABLE public.ffn_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "images of published notes are public" ON public.ffn_images
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.ffn_notes n WHERE n.id = note_id AND n.status = 'published'));
CREATE POLICY "archive members read note images" ON public.ffn_images
  FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "admins write note images" ON public.ffn_images
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER ffn_images_updated_at BEFORE UPDATE ON public.ffn_images
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ffn_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_id uuid NOT NULL REFERENCES public.ffn_notes(id) ON DELETE CASCADE,
  b_id uuid NOT NULL REFERENCES public.ffn_notes(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (a_id, b_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ffn_relations TO authenticated;
GRANT SELECT ON public.ffn_relations TO anon;
GRANT ALL ON public.ffn_relations TO service_role;
ALTER TABLE public.ffn_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relations are public" ON public.ffn_relations FOR SELECT USING (true);
CREATE POLICY "admins write relations" ON public.ffn_relations
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.ffn_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.ffn_notes(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ref_id uuid NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, kind, ref_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ffn_entity_links TO authenticated;
GRANT SELECT ON public.ffn_entity_links TO anon;
GRANT ALL ON public.ffn_entity_links TO service_role;
ALTER TABLE public.ffn_entity_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entity links are public" ON public.ffn_entity_links FOR SELECT USING (true);
CREATE POLICY "admins write entity links" ON public.ffn_entity_links
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.ffn_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.ffn_notes(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'letter',
  ref_id uuid,
  ref_label text,
  excerpt text,
  state text NOT NULL DEFAULT 'auto',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ffn_occurrences TO authenticated;
GRANT SELECT ON public.ffn_occurrences TO anon;
GRANT ALL ON public.ffn_occurrences TO service_role;
ALTER TABLE public.ffn_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "occurrences of published notes are public" ON public.ffn_occurrences
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.ffn_notes n WHERE n.id = note_id AND n.status = 'published'));
CREATE POLICY "archive members read occurrences" ON public.ffn_occurrences
  FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "admins write occurrences" ON public.ffn_occurrences
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX ffn_occurrences_note_idx ON public.ffn_occurrences (note_id);
CREATE TRIGGER ffn_occurrences_updated_at BEFORE UPDATE ON public.ffn_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();