-- Trigger functions are fired by table triggers, never called directly.
REVOKE EXECUTE ON FUNCTION public.sync_letter_transcription_status() FROM anon, authenticated;