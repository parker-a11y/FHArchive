CREATE TABLE public.photo_sleeves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text,
  box_id uuid REFERENCES public.photo_boxes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photo_sleeves_code_key UNIQUE (code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_sleeves TO authenticated;
GRANT ALL ON public.photo_sleeves TO service_role;
ALTER TABLE public.photo_sleeves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readers view photo sleeves" ON public.photo_sleeves FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "admins add photo sleeves" ON public.photo_sleeves FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins update photo sleeves" ON public.photo_sleeves FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins remove photo sleeves" ON public.photo_sleeves FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX photo_sleeves_box_idx ON public.photo_sleeves(box_id);

ALTER TABLE public.photos ADD COLUMN sleeve_id uuid REFERENCES public.photo_sleeves(id) ON DELETE SET NULL;
CREATE INDEX photos_sleeve_idx ON public.photos(sleeve_id);

-- A sleeved photo always sits in its sleeve's box.
CREATE OR REPLACE FUNCTION public.photo_follow_sleeve_box() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sleeve_id IS NOT NULL THEN
    SELECT box_id INTO NEW.box_id FROM public.photo_sleeves WHERE id = NEW.sleeve_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER photos_follow_sleeve_box BEFORE INSERT OR UPDATE OF sleeve_id, box_id ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.photo_follow_sleeve_box();

CREATE OR REPLACE FUNCTION public.sleeve_move_photos() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.photos SET box_id = NEW.box_id WHERE sleeve_id = NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER photo_sleeves_move_photos AFTER UPDATE OF box_id ON public.photo_sleeves
  FOR EACH ROW WHEN (OLD.box_id IS DISTINCT FROM NEW.box_id) EXECUTE FUNCTION public.sleeve_move_photos();