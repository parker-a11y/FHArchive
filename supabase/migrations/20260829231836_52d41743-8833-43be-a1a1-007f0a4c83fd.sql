-- 1. Roles ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'guest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

-- 2. Profiles ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_approved_guest(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = _user_id AND r.role = 'guest' AND p.status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_archive(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id) OR public.is_approved_guest(_user_id);
$$;

CREATE POLICY "own profile readable" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "self insert pending profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND status = 'pending');
CREATE POLICY "admins manage profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "roles readable by self and admin" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Seed: every existing account is an administrator --------------------
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, status, approved_at)
SELECT id, COALESCE(email, ''), COALESCE(raw_user_meta_data->>'full_name', ''), 'approved', now()
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. Guest read access + admin-only writes on every archive table --------
DO $$
DECLARE t text;
  readable text[] := ARRAY[
    'letters','digital_files','file_derivatives','scan_transcriptions','historical_references',
    'letter_events','letter_keywords','letter_organizations','letter_people','letter_places',
    'letter_relations','letter_sources','keywords','people','places','organizations','events',
    'record_categories','tone_options','source_containers','container_files','digital_sources',
    'ds_events','ds_files','ds_keywords','ds_organizations','ds_people','ds_places','ds_segments'
  ];
  writable_locked text[] := ARRAY[
    'letters','digital_files','file_derivatives','scan_transcriptions','historical_references',
    'letter_events','letter_keywords','letter_organizations','letter_people','letter_places',
    'letter_relations','letter_sources','keywords','people','places','organizations','events',
    'record_categories','tone_options','source_containers','container_files','digital_sources',
    'ds_events','ds_files','ds_keywords','ds_organizations','ds_people','ds_places','ds_segments',
    'ai_suggestions','edit_history','record_shares','source_shares',
    'archive_counter','ds_counter','container_counter'
  ];
BEGIN
  FOREACH t IN ARRAY readable LOOP
    EXECUTE format('DROP POLICY IF EXISTS "approved users can read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "approved users can read" ON public.%I FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()))', t);
  END LOOP;

  FOREACH t IN ARRAY writable_locked LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin only insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin only update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin only delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "admin only insert" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "admin only update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "admin only delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_admin(auth.uid()))', t);
  END LOOP;
END $$;

-- 5. Archive contacts ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.archive_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  notes text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_contacts TO authenticated;
GRANT ALL ON public.archive_contacts TO service_role;
ALTER TABLE public.archive_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage contacts" ON public.archive_contacts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND owner_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND owner_id = auth.uid());
CREATE TRIGGER archive_contacts_updated BEFORE UPDATE ON public.archive_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Sent archive emails -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.archive_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  sender_email text,
  subject text NOT NULL,
  message_body text,
  header_title text,
  header_subtitle text,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachment_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_emails TO authenticated;
GRANT ALL ON public.archive_emails TO service_role;
ALTER TABLE public.archive_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archive emails" ON public.archive_emails
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND owner_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND owner_id = auth.uid());
CREATE TRIGGER archive_emails_updated BEFORE UPDATE ON public.archive_emails
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.archive_email_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  email_id uuid NOT NULL REFERENCES public.archive_emails(id) ON DELETE CASCADE,
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  archive_id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_email_records TO authenticated;
GRANT ALL ON public.archive_email_records TO service_role;
ALTER TABLE public.archive_email_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archive email records" ON public.archive_email_records
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND owner_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.archive_email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  email_id uuid NOT NULL REFERENCES public.archive_emails(id) ON DELETE CASCADE,
  letter_id uuid REFERENCES public.letters(id) ON DELETE SET NULL,
  archive_id text,
  filename text NOT NULL,
  storage_path text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_email_attachments TO authenticated;
GRANT ALL ON public.archive_email_attachments TO service_role;
ALTER TABLE public.archive_email_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archive email attachments" ON public.archive_email_attachments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND owner_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS archive_email_records_letter_idx ON public.archive_email_records(letter_id);
CREATE INDEX IF NOT EXISTS archive_email_records_email_idx ON public.archive_email_records(email_id);
CREATE INDEX IF NOT EXISTS archive_email_attachments_email_idx ON public.archive_email_attachments(email_id);