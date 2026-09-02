-- Duplicate indexes: keep one per column set.
-- Where a unique constraint already covers the columns, the plain index is dropped.
DROP INDEX IF EXISTS public.idx_ai_suggestions_letter_field;
DROP INDEX IF EXISTS public.letters_seq_idx;
DROP INDEX IF EXISTS public.record_shares_token_idx;

-- Otherwise keep the idx_* naming convention and drop the *_idx twin.
DROP INDEX IF EXISTS public.edit_history_created_at_idx;
DROP INDEX IF EXISTS public.edit_history_letter_idx;
DROP INDEX IF EXISTS public.file_derivatives_letter_idx;
DROP INDEX IF EXISTS public.letter_events_event_idx;
DROP INDEX IF EXISTS public.letter_events_letter_idx;
DROP INDEX IF EXISTS public.letter_keywords_keyword_idx;
DROP INDEX IF EXISTS public.letter_organizations_letter_idx;
DROP INDEX IF EXISTS public.letter_organizations_org_idx;
DROP INDEX IF EXISTS public.letter_people_person_idx;
DROP INDEX IF EXISTS public.letter_places_place_idx;
DROP INDEX IF EXISTS public.letters_sort_date_idx;
DROP INDEX IF EXISTS public.scan_transcriptions_letter_idx;