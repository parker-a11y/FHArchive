ALTER TABLE public.weekly_recaps ADD COLUMN IF NOT EXISTS public_visible boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Archive readers see published recaps" ON public.weekly_recaps;
CREATE POLICY "Recap visibility" ON public.weekly_recaps FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_edit_archive(auth.uid())
  OR (status = 'published' AND public_visible AND can_read_archive(auth.uid()))
);