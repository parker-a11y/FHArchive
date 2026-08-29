CREATE UNIQUE INDEX IF NOT EXISTS ai_suggestions_letter_field_key
  ON public.ai_suggestions (letter_id, field_key);