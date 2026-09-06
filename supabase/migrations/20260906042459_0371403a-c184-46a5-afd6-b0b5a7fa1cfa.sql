CREATE POLICY "ffn images readable" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ffn-images' AND public.can_read_archive(auth.uid()));

CREATE POLICY "ffn images insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ffn-images' AND public.can_edit_archive(auth.uid()));

CREATE POLICY "ffn images update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ffn-images' AND public.can_edit_archive(auth.uid()))
WITH CHECK (bucket_id = 'ffn-images' AND public.can_edit_archive(auth.uid()));

CREATE POLICY "ffn images delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ffn-images' AND public.can_edit_archive(auth.uid()));