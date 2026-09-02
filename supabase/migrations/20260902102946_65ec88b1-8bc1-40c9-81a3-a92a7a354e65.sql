ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS forwarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forwarded_to text,
  ADD COLUMN IF NOT EXISTS postal_service text,
  ADD COLUMN IF NOT EXISTS postal_notes text;

CREATE INDEX IF NOT EXISTS letters_postal_service_idx ON public.letters (postal_service);
CREATE INDEX IF NOT EXISTS letters_forwarded_idx ON public.letters (forwarded) WHERE forwarded;