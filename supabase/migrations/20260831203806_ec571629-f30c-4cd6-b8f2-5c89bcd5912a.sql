ALTER TABLE public.edit_history
  ADD COLUMN IF NOT EXISTS actor_id uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS actor_email text,
  ADD COLUMN IF NOT EXISTS actor_name text;

CREATE INDEX IF NOT EXISTS edit_history_created_at_idx ON public.edit_history (created_at DESC);

CREATE OR REPLACE FUNCTION public.stamp_edit_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.actor_id IS NULL THEN NEW.actor_id := auth.uid(); END IF;
  IF NEW.actor_id IS NOT NULL AND (NEW.actor_email IS NULL OR NEW.actor_name IS NULL) THEN
    SELECT COALESCE(NEW.actor_email, p.email), COALESCE(NEW.actor_name, p.full_name)
      INTO NEW.actor_email, NEW.actor_name
      FROM public.profiles p WHERE p.id = NEW.actor_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS stamp_edit_actor ON public.edit_history;
CREATE TRIGGER stamp_edit_actor BEFORE INSERT ON public.edit_history
FOR EACH ROW EXECUTE FUNCTION public.stamp_edit_actor();

DROP POLICY IF EXISTS "archivists update containers" ON public.source_containers;
CREATE POLICY "archivists update containers" ON public.source_containers
FOR UPDATE TO authenticated
USING (public.is_approved_archivist(auth.uid()))
WITH CHECK (public.is_approved_archivist(auth.uid()));

DROP POLICY IF EXISTS "archivists update container files" ON public.container_files;
CREATE POLICY "archivists update container files" ON public.container_files
FOR UPDATE TO authenticated
USING (public.is_approved_archivist(auth.uid()))
WITH CHECK (public.is_approved_archivist(auth.uid()));