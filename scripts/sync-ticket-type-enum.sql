-- ============================================================================
-- CyberITSM SPN — Sincronização cirúrgica do tipo da coluna `tickets.type`
-- ----------------------------------------------------------------------------
-- Corrige o erro:  type "public.TicketType" does not exist
--
-- Contexto: o schema Prisma declara `type TicketType` (enum PostgreSQL) para o
-- model Ticket. A tabela real (criada via supabase-schema.sql) usa `type TEXT`
-- com CHECK. Sem o enum no banco, as queries Prisma (ex.: list_active_epics do
-- MCP de Kanban) falham ao fazer bind do parâmetro como "TicketType".
--
-- Este script é IDEMPOTENTE e NÃO destrutivo: cria o enum apenas se ausente e
-- converte a coluna preservando os dados (valores já são EPICO/ATIVIDADE/TAREFA).
--
-- NÃO usar `prisma db push` aqui: o schema Prisma cobre apenas o bounded
-- context de Security QA + Ticket/Sprint; o banco real contém dezenas de
-- tabelas ITSM fora do schema (users_profiles, audit_logs, ticket_statuses...)
-- que seriam DROPADAS pelo push. Aplicar via: prisma db execute --file.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE n.nspname = 'public'
       AND t.typname = 'TicketType'
  ) THEN
    CREATE TYPE "public"."TicketType" AS ENUM ('EPICO', 'ATIVIDADE', 'TAREFA');
  END IF;
END $$;

-- A constraint CHECK legada (type IN (...)) bloqueia o cast para enum, pois
-- compara o enum com literais text. O enum em si já garante os valores válidos.
ALTER TABLE "public"."tickets" DROP CONSTRAINT IF EXISTS "tickets_type_check";

-- Dropa o default TEXT temporariamente (cast automático não suportado para enum).
ALTER TABLE "public"."tickets" ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "public"."tickets"
  ALTER COLUMN "type" SET DATA TYPE "public"."TicketType"
  USING "type"::"public"."TicketType";

-- Restaura o default, agora tipado como enum.
ALTER TABLE "public"."tickets"
  ALTER COLUMN "type" SET DEFAULT 'TAREFA'::"public"."TicketType";

-- Recarrega o cache de schema do PostgREST (Supabase API).
NOTIFY pgrst, 'reload schema';
