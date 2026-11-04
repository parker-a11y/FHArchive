ALTER TABLE public.book_items ADD COLUMN IF NOT EXISTS page_doc jsonb;
ALTER TABLE public.book_items ADD CONSTRAINT book_items_kind_check CHECK ((item_type = 'record' AND letter_id IS NOT NULL) OR (item_type = 'page' AND page_doc IS NOT NULL)) NOT VALID;
CREATE POLICY "editors read book images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'book-images' AND public.can_edit_archive(auth.uid()));
CREATE POLICY "editors upload book images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'book-images' AND public.can_edit_archive(auth.uid()));
CREATE POLICY "editors update book images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'book-images' AND public.can_edit_archive(auth.uid())) WITH CHECK (bucket_id = 'book-images' AND public.can_edit_archive(auth.uid()));
CREATE POLICY "editors delete book images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'book-images' AND public.can_edit_archive(auth.uid()));