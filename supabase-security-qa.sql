-- ============================================================================
-- Centro de Security QA — Bounded Context isolado
-- Migração independente do ITSM legado. Aplique em Supabase > SQL Editor
-- (ou como migration dedicada). Nenhuma tabela existente é alterada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Buckets de storage
--    qa-temp-evidences : upload direto do frontend (evidência bruta, efêmera)
--    qa-logs-archive   : arquivo .gz forense (somente service role, server-side)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('qa-temp-evidences', 'qa-temp-evidences', false, 5242880, '{application/json,application/xml,text/plain,application/x-www-form-urlencoded}'),
  ('qa-logs-archive', 'qa-logs-archive', false, 26214400, '{application/gzip,application/x-gzip}')
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Bucket temporário: usuário autenticado pode enviar e ler evidências.
drop policy if exists "security_qa_temp_insert_auth" on storage.objects;
create policy "security_qa_temp_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'qa-temp-evidences');

drop policy if exists "security_qa_temp_select_auth" on storage.objects;
create policy "security_qa_temp_select_auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'qa-temp-evidences');

-- Bucket de arquivamento: exclusivo para service role (expurgo/servidor).
drop policy if exists "security_qa_archive_service_role" on storage.objects;
create policy "security_qa_archive_service_role"
  on storage.objects
  to service_role
  using (bucket_id = 'qa-logs-archive')
  with check (bucket_id = 'qa-logs-archive');

-- ----------------------------------------------------------------------------
-- 2. Tabela de resultados (qa_results)
-- ----------------------------------------------------------------------------
create table if not exists public.qa_results (
  id                   uuid primary key default gen_random_uuid(),
  project_name         text not null,
  environment_url      text not null,
  requirements         text not null,
  original_file_name   text not null,
  temp_storage_path    text,
  archived_file_path   text not null,
  archived_file_url    text,
  archived_size_bytes  bigint not null default 0,
  original_size_bytes  bigint not null default 0,
  compression_ratio    numeric(6, 4),
  compliance_percent   numeric(5, 2) not null,
  overall_rating       text not null,
  executive_summary    text not null,
  findings             jsonb not null default '[]'::jsonb,
  status               text not null default 'concluido'
                       check (status in ('concluido', 'falha')),
  error_message        text,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_qa_results_created_at
  on public.qa_results (created_at desc);
create index if not exists idx_qa_results_project_name
  on public.qa_results (project_name);
create index if not exists idx_qa_results_created_by
  on public.qa_results (created_by);

-- RLS: a leitura é feita via service role (módulo isolado). Usuários legados
-- do ITSM continuam sem acesso direto a esta tabela.
alter table public.qa_results enable row level security;

drop policy if exists "security_qa_results_service_read" on public.qa_results;
create policy "security_qa_results_service_read"
  on public.qa_results for select
  to service_role using (true);

drop policy if exists "security_qa_results_service_insert" on public.qa_results;
create policy "security_qa_results_service_insert"
  on public.qa_results for insert
  to service_role with check (true);
