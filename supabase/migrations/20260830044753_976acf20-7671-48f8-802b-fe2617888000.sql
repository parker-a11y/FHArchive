-- Junction table indexes: letter_id lookups
CREATE INDEX IF NOT EXISTS letter_organizations_letter_idx ON public.letter_organizations (letter_id);
CREATE INDEX IF NOT EXISTS letter_events_letter_idx ON public.letter_events (letter_id);

-- Reverse-FK indexes for entity detail pages
CREATE INDEX IF NOT EXISTS letter_keywords_keyword_idx ON public.letter_keywords (keyword_id);
CREATE INDEX IF NOT EXISTS letter_people_person_idx ON public.letter_people (person_id);
CREATE INDEX IF NOT EXISTS letter_places_place_idx ON public.letter_places (place_id);
CREATE INDEX IF NOT EXISTS letter_organizations_org_idx ON public.letter_organizations (organization_id);
CREATE INDEX IF NOT EXISTS letter_events_event_idx ON public.letter_events (event_id);

-- Trigram GIN indexes for fast SQL text search on letters
CREATE INDEX IF NOT EXISTS letters_title_trgm ON public.letters USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS letters_notes_trgm ON public.letters USING gin (notes gin_trgm_ops);
CREATE INDEX IF NOT EXISTS letters_author_trgm ON public.letters USING gin (author gin_trgm_ops);
CREATE INDEX IF NOT EXISTS letters_recipient_trgm ON public.letters USING gin (recipient gin_trgm_ops);
CREATE INDEX IF NOT EXISTS letters_summary_short_trgm ON public.letters USING gin (summary_short gin_trgm_ops);
CREATE INDEX IF NOT EXISTS letters_transcription_trgm ON public.letters USING gin (transcription_verified gin_trgm_ops);
CREATE INDEX IF NOT EXISTS letters_archive_id_trgm ON public.letters USING gin (archive_id gin_trgm_ops);