CREATE TABLE public.ask_francis_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  user_name text,
  question text NOT NULL,
  answer text,
  confidence text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ask_francis_queries TO authenticated;
GRANT ALL ON public.ask_francis_queries TO service_role;
ALTER TABLE public.ask_francis_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view ask history" ON public.ask_francis_queries
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ask_francis_queries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ask_francis_queries_created_at_idx ON public.ask_francis_queries (created_at DESC);