alter table public.letters
  add column if not exists envelope_reviewed boolean not null default false,
  add column if not exists envelope_reviewed_at timestamptz;

comment on column public.letters.envelope_reviewed is 'Envelope Review: set true when the envelope has been reviewed and verified (saved) in Envelope Review';