-- ============================================
-- CyberITSM SPN - Migração e Normalização do Status de Chamados
-- ============================================
-- Corrige o erro de integridade relacional 23514
-- (violates check constraint "tickets_status_check").
--
-- A constraint antiga aceita estados em minúsculo ('aberto', 'em_andamento',
-- 'em_revisao', ...) que NÃO reconhecem a nova Máquina de Estados em maiúsculo:
--   ABERTO | EM_ANDAMENTO | BLOQUEADO | FECHADO | CANCELADO
--
-- Execute este script no Supabase SQL Editor (idempotente).
-- ============================================

-- 1) REMOVE A CONSTRAINT ANTIGA (não reconhece a nova máquina de estados)
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_status_check";

-- 2) NORMALIZA OS DADOS LEGADOS para a nova máquina de estados (maiúsculo).
--    Estados legados absorvidos pela nova máquina:
--      'em_revisao'    -> 'EM_ANDAMENTO'
--      'em andamento'  -> 'EM_ANDAMENTO'
--      fallback seguro -> 'ABERTO'
UPDATE "tickets"
SET status = CASE
  WHEN UPPER(REPLACE(status, ' ', '_')) IN ('ABERTO', 'OPEN') THEN 'ABERTO'
  WHEN UPPER(REPLACE(status, ' ', '_')) IN ('EM_ANDAMENTO', 'EM_REVISAO', 'IN_PROGRESS') THEN 'EM_ANDAMENTO'
  WHEN UPPER(REPLACE(status, ' ', '_')) IN ('BLOQUEADO', 'BLOCKED') THEN 'BLOQUEADO'
  WHEN UPPER(REPLACE(status, ' ', '_')) IN ('FECHADO', 'CLOSED', 'CONCLUIDO', 'DONE') THEN 'FECHADO'
  WHEN UPPER(REPLACE(status, ' ', '_')) IN ('CANCELADO', 'CANCELLED', 'CANCELED') THEN 'CANCELADO'
  ELSE 'ABERTO'
END;

-- 3) NOVO DEFAULT DA COLUNA (evita 23514 em INSERTs sem status explícito)
ALTER TABLE "tickets" ALTER COLUMN status SET DEFAULT 'ABERTO';

-- 4) NOVA CONSTRAINT RIGOROSA — apenas os estados da Máquina de Estados atual
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_check"
  CHECK (status IN ('ABERTO', 'EM_ANDAMENTO', 'BLOQUEADO', 'FECHADO', 'CANCELADO'));

-- 5) Recarrega o schema cache do PostgREST (Supabase API)
NOTIFY pgrst, 'reload schema';
