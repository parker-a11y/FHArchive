-- Date / ordering indexes on records
CREATE INDEX IF NOT EXISTS idx_letters_normalized_date ON public.letters (normalized_date);
CREATE INDEX IF NOT EXISTS idx_letters_sort_date ON public.letters (sort_date);
CREATE INDEX IF NOT EXISTS idx_letters_created_at ON public.letters (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_letters_record_type ON public.letters (record_type);
CREATE INDEX IF NOT EXISTS idx_letters_period ON public.letters (period);
CREATE INDEX IF NOT EXISTS idx_letters_starred ON public.letters (starred) WHERE starred;

-- Daily-summary / activity counts
CREATE INDEX IF NOT EXISTS idx_digital_files_created_at ON public.digital_files (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ds_files_created_at ON public.ds_files (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_container_files_created_at ON public.container_files (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_transcriptions_created_at ON public.scan_transcriptions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digital_sources_created_at ON public.digital_sources (created_at DESC);

-- Per-record child lookups
CREATE INDEX IF NOT EXISTS idx_digital_files_letter_id ON public.digital_files (letter_id);
CREATE INDEX IF NOT EXISTS idx_file_derivatives_letter_id ON public.file_derivatives (letter_id);
CREATE INDEX IF NOT EXISTS idx_scan_transcriptions_letter_id ON public.scan_transcriptions (letter_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_letter_field ON public.ai_suggestions (letter_id, field_key);

-- Edit history: always read filtered by record, newest first
CREATE INDEX IF NOT EXISTS idx_edit_history_letter_created ON public.edit_history (letter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edit_history_created_at ON public.edit_history (created_at DESC);

-- Junction tables (forward and reverse lookups)
CREATE INDEX IF NOT EXISTS idx_letter_keywords_letter ON public.letter_keywords (letter_id);
CREATE INDEX IF NOT EXISTS idx_letter_keywords_keyword ON public.letter_keywords (keyword_id);
CREATE INDEX IF NOT EXISTS idx_letter_people_letter ON public.letter_people (letter_id);
CREATE INDEX IF NOT EXISTS idx_letter_people_person ON public.letter_people (person_id);
CREATE INDEX IF NOT EXISTS idx_letter_places_letter ON public.letter_places (letter_id);
CREATE INDEX IF NOT EXISTS idx_letter_places_place ON public.letter_places (place_id);
CREATE INDEX IF NOT EXISTS idx_letter_organizations_letter ON public.letter_organizations (letter_id);
CREATE INDEX IF NOT EXISTS idx_letter_organizations_org ON public.letter_organizations (organization_id);
CREATE INDEX IF NOT EXISTS idx_letter_events_letter ON public.letter_events (letter_id);
CREATE INDEX IF NOT EXISTS idx_letter_events_event ON public.letter_events (event_id);
CREATE INDEX IF NOT EXISTS idx_letter_sources_letter ON public.letter_sources (letter_id);
CREATE INDEX IF NOT EXISTS idx_letter_sources_source ON public.letter_sources (source_id);
CREATE INDEX IF NOT EXISTS idx_ds_keywords_source ON public.ds_keywords (source_id);
CREATE INDEX IF NOT EXISTS idx_ds_keywords_keyword ON public.ds_keywords (keyword_id);
CREATE INDEX IF NOT EXISTS idx_ds_people_source ON public.ds_people (source_id);
CREATE INDEX IF NOT EXISTS idx_ds_people_person ON public.ds_people (person_id);
CREATE INDEX IF NOT EXISTS idx_ds_places_source ON public.ds_places (source_id);
CREATE INDEX IF NOT EXISTS idx_ds_organizations_source ON public.ds_organizations (source_id);
CREATE INDEX IF NOT EXISTS idx_ds_events_source ON public.ds_events (source_id);
CREATE INDEX IF NOT EXISTS idx_ds_files_source ON public.ds_files (source_id);
CREATE INDEX IF NOT EXISTS idx_container_files_container ON public.container_files (container_id);

-- Cross-reference lookups
CREATE INDEX IF NOT EXISTS idx_record_links_a ON public.record_links (a_kind, a_id);
CREATE INDEX IF NOT EXISTS idx_record_links_b ON public.record_links (b_kind, b_id);

-- Name lookups used by pickers and duplicate detection
CREATE INDEX IF NOT EXISTS idx_keywords_name_lower ON public.keywords (lower(name));
CREATE INDEX IF NOT EXISTS idx_people_name_lower ON public.people (lower(name));
CREATE INDEX IF NOT EXISTS idx_places_name_lower ON public.places (lower(canonical_name));
CREATE INDEX IF NOT EXISTS idx_record_categories_kind ON public.record_categories (kind, parent_type);