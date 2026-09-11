REVOKE ALL ON FUNCTION public.mark_self_for_reindex() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_letter_for_reindex() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_research_chunks(vector, int, text[], date, date, text, text, text[], text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_research_chunks(vector, int, text[], date, date, text, text, text[], text, text, text, text) TO service_role;