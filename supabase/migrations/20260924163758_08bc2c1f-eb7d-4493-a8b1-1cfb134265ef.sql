alter table public.ask_francis_queries add column if not exists share_token text;
create unique index if not exists ask_francis_queries_share_token_idx on public.ask_francis_queries (share_token) where share_token is not null;
grant update on public.ask_francis_queries to authenticated;
drop policy if exists "Admins can update ask history" on public.ask_francis_queries;
create policy "Admins can update ask history" on public.ask_francis_queries
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));