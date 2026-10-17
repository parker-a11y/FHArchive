create policy "Authenticated users can read uploaded images"
on storage.objects for select to authenticated
using (bucket_id = 'uploaded-images');

create policy "Authenticated users can upload images"
on storage.objects for insert to authenticated
with check (bucket_id = 'uploaded-images');

create policy "Authenticated users can update uploaded images"
on storage.objects for update to authenticated
using (bucket_id = 'uploaded-images');

create policy "Authenticated users can delete uploaded images"
on storage.objects for delete to authenticated
using (bucket_id = 'uploaded-images');