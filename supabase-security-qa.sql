-- ============================================================================
-- Centro de Security QA — Bounded Context isolado
-- Migração independente do ITSM legado. Aplique em Supabase > SQL Editor
-- (ou como migration dedicada). Nenhuma tabela existente é alterada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Buckets de storage
--    qa-temp-evidences : upload direto do frontend (evidência bruta, efêmera)
--    qa-logs-archive   : arquivo .gz forense (somente service role, server-side)
--    qa-pdf-reports    : laudos PDF gerados pelo worker (service role)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('qa-temp-evidences', 'qa-temp-evidences', false, 5242880, '{application/json,application/xml,text/plain,application/x-www-form-urlencoded}'),
  ('qa-logs-archive', 'qa-logs-archive', false, 26214400, '{application/gzip,application/x-gzip}'),
  ('qa-pdf-reports', 'qa-pdf-reports', false, 10485760, '{application/pdf}')
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
--    Idempotente: em tabelas preexistentes (parciais), as colunas faltantes
--    são adicionadas via "alter table add column if not exists" abaixo.
-- ----------------------------------------------------------------------------
create table if not exists public.qa_results (
  id                   uuid primary key default gen_random_uuid(),
  project_name         text not null,
  environment_url      text not null,
  requirements         text not null,
  original_file_name   text not null,
  temp_storage_path    text,
  archived_file_path   text,
  archived_file_url    text,
  archived_size_bytes  bigint default 0,
  original_size_bytes  bigint default 0,
  compression_ratio    numeric(6, 4),
  compliance_percent   numeric(5, 2),
  overall_rating       text,
  executive_summary    text,
  findings             jsonb not null default '[]'::jsonb,
  status               text not null default 'PROCESSANDO',
  error_message        text,
  created_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Reparo idempotente: garante cada coluna usada pelo INSERT da API
alter table public.qa_results add column if not exists project_name        text not null default '';
alter table public.qa_results add column if not exists environment_url     text not null default '';
alter table public.qa_results add column if not exists requirements        text not null default '';
alter table public.qa_results add column if not exists original_file_name  text not null default '';
alter table public.qa_results add column if not exists temp_storage_path   text;
alter table public.qa_results add column if not exists archived_file_path  text;
alter table public.qa_results add column if not exists archived_file_url   text;
alter table public.qa_results add column if not exists archived_size_bytes bigint default 0;
alter table public.qa_results add column if not exists original_size_bytes bigint default 0;
alter table public.qa_results add column if not exists compression_ratio   numeric(6, 4);
alter table public.qa_results add column if not exists compliance_percent  numeric(5, 2);
alter table public.qa_results add column if not exists overall_rating      text;
alter table public.qa_results add column if not exists executive_summary   text;
alter table public.qa_results add column if not exists findings            jsonb not null default '[]'::jsonb;
alter table public.qa_results add column if not exists status              text not null default 'PROCESSANDO';
alter table public.qa_results add column if not exists error_message       text;
alter table public.qa_results add column if not exists created_by          uuid;
alter table public.qa_results add column if not exists created_at          timestamptz not null default now();
alter table public.qa_results add column if not exists updated_at          timestamptz not null default now();

-- Ajusta as colunas da tabela existente removendo NOT NULL de campos preenchidos de forma assíncrona
alter table public.qa_results alter column archived_file_path drop not null;
alter table public.qa_results alter column archived_size_bytes drop not null;
alter table public.qa_results alter column original_size_bytes drop not null;
alter table public.qa_results alter column compliance_percent drop not null;
alter table public.qa_results alter column overall_rating drop not null;
alter table public.qa_results alter column executive_summary drop not null;

-- Constraint de status + FK para auth.users (recriadas com segurança)
alter table public.qa_results drop constraint if exists qa_results_status_check;
alter table public.qa_results add constraint qa_results_status_check
  check (status in ('PROCESSANDO', 'CONCLUIDO', 'FALHA'));

alter table public.qa_results alter column status set default 'PROCESSANDO';

alter table public.qa_results drop constraint if exists qa_results_created_by_fkey;
alter table public.qa_results add constraint qa_results_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

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

-- ----------------------------------------------------------------------------
-- 4. Background + Realtime (monolito orientado a eventos)
--    O worker (Inngest) promove o status de PROCESSANDO -> CONCLUIDO/FALHA e a
--    UI acompanha via Supabase Realtime. Para isso a tabela precisa:
--      a) estar na publicação supabase_realtime;
--      b) REPLICA IDENTITY FULL (payload old + new nos UPDATEs);
--      c) política de SELECT para o usuário autenticado (chave anon).
-- ----------------------------------------------------------------------------
alter table public.qa_results replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'qa_results'
  ) then
    alter publication supabase_realtime add table public.qa_results;
  end if;
end $$;

drop policy if exists "security_qa_results_select_auth" on public.qa_results;
create policy "security_qa_results_select_auth"
  on public.qa_results for select
  to authenticated using (true);
