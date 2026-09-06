DROP POLICY IF EXISTS "occurrences of published notes are public" ON public.ffn_occurrences;

CREATE POLICY "approved readers can view note occurrences"
ON public.ffn_occurrences
FOR SELECT
TO authenticated
USING (public.can_read_archive(auth.uid()));

CREATE POLICY "public occurrences require a public record"
ON public.ffn_occurrences
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.ffn_notes n
    WHERE n.id = ffn_occurrences.note_id
      AND n.status = 'published'
  )
  AND ffn_occurrences.kind = 'letter'
  AND EXISTS (
    SELECT 1
    FROM public.letters l
    WHERE l.id = ffn_occurrences.ref_id
      AND l.visibility = 'public'
  )
);