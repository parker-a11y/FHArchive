DROP POLICY IF EXISTS "entity links are public" ON public.ffn_entity_links;
CREATE POLICY "Public can read published entity links"
ON public.ffn_entity_links
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.ffn_notes n
    WHERE n.id = ffn_entity_links.note_id AND n.status = 'published'
  )
);

DROP POLICY IF EXISTS "relations are public" ON public.ffn_relations;
CREATE POLICY "Public can read published relations"
ON public.ffn_relations
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.ffn_notes a
    WHERE a.id = ffn_relations.a_id AND a.status = 'published'
  )
  AND EXISTS (
    SELECT 1 FROM public.ffn_notes b
    WHERE b.id = ffn_relations.b_id AND b.status = 'published'
  )
);