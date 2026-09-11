-- Tighten research_chunks read access to approved archive readers only,
-- matching the rest of the archive schema.
DROP POLICY IF EXISTS "approved users can read" ON public.research_chunks;

CREATE POLICY "approved users can read"
  ON public.research_chunks
  FOR SELECT
  TO authenticated
  USING (public.can_read_archive(auth.uid()));