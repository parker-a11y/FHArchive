CREATE OR REPLACE FUNCTION public.log_link_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_letter uuid; v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RETURN NULL; END IF;
  v_letter := CASE WHEN TG_OP = 'DELETE' THEN OLD.letter_id ELSE NEW.letter_id END;
  INSERT INTO public.edit_history (owner_id, letter_id, entity, field_key, old_value, new_value, actor_id)
  VALUES (
    COALESCE(public.archive_owner_id(), v_actor),
    v_letter,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN 'unlinked' ELSE 'linked' END,
    NULL, NULL, v_actor
  );
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.log_link_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['letter_people','letter_places','letter_keywords','letter_organizations','letter_events']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS log_link_change ON public.%I', t);
    EXECUTE format('CREATE TRIGGER log_link_change AFTER INSERT OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_link_change()', t);
  END LOOP;
END $$;