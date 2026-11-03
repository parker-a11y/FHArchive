CREATE POLICY "archivists read archive emails" ON public.archive_emails
  FOR SELECT TO authenticated
  USING (public.is_approved_archivist(auth.uid()) AND status <> 'draft');
CREATE POLICY "archivists read archive email records" ON public.archive_email_records
  FOR SELECT TO authenticated
  USING (public.is_approved_archivist(auth.uid()) AND EXISTS (SELECT 1 FROM public.archive_emails e WHERE e.id = email_id AND e.status <> 'draft'));
CREATE POLICY "archivists read archive email attachments" ON public.archive_email_attachments
  FOR SELECT TO authenticated
  USING (public.is_approved_archivist(auth.uid()) AND EXISTS (SELECT 1 FROM public.archive_emails e WHERE e.id = email_id AND e.status <> 'draft'));