revoke all on function public.match_research_chunks(vector, int) from public, anon;
grant execute on function public.match_research_chunks(vector, int) to authenticated, service_role;