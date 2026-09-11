create extension if not exists vector;

create table if not exists public.research_chunks (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  archive_id text not null,
  chunk_index int not null,
  content text not null,
  content_hash text not null,
  embedding vector(3072) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, archive_id, chunk_index)
);

grant select on public.research_chunks to authenticated;
grant all on public.research_chunks to service_role;

alter table public.research_chunks enable row level security;

create policy "Authenticated accounts can read research chunks"
  on public.research_chunks for select to authenticated using (true);

create index if not exists research_chunks_embedding_idx
  on public.research_chunks using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create index if not exists research_chunks_record_idx
  on public.research_chunks (kind, archive_id);

create or replace function public.set_research_chunks_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger research_chunks_updated_at
  before update on public.research_chunks
  for each row execute function public.set_research_chunks_updated_at();

create or replace function public.match_research_chunks(
  query_embedding vector(3072),
  match_count int default 40
)
returns table (kind text, archive_id text, chunk_index int, content text, similarity float)
language sql
stable
security definer
set search_path = public
as $$
  select c.kind, c.archive_id, c.chunk_index, c.content,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.research_chunks c
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;

alter table public.ask_francis_queries add column if not exists corpus jsonb;