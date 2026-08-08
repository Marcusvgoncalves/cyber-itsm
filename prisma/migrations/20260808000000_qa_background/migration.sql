-- ============================================================================
-- Refactor: Security QA processado em background (Inngest) + Supabase Realtime
--
-- O publisher cria o registro em public.qa_results com status 'PROCESSANDO'
-- apenas com os metadados da evidência. O worker de background preenche os
-- campos de conformidade/arquivamento/PDF e promove o status para 'CONCLUIDO'.
-- A UI acompanha a transição via Supabase Realtime (postgres_changes).
--
-- Idempotente e seguro para rodar em banco novo ou legado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Colunas que só existem após a análise passam a ser opcionais.
-- ---------------------------------------------------------------------------
ALTER TABLE "qa_results" ALTER COLUMN "archived_file_path" DROP NOT NULL;
ALTER TABLE "qa_results" ALTER COLUMN "archived_size_bytes" DROP NOT NULL;
ALTER TABLE "qa_results" ALTER COLUMN "original_size_bytes" DROP NOT NULL;
ALTER TABLE "qa_results" ALTER COLUMN "compliance_percent" DROP NOT NULL;
ALTER TABLE "qa_results" ALTER COLUMN "overall_rating" DROP NOT NULL;
ALTER TABLE "qa_results" ALTER COLUMN "executive_summary" DROP NOT NULL;

-- Default para a coluna JSON findings (registros em PROCESSANDO criados sem findings).
ALTER TABLE "qa_results" ALTER COLUMN "findings" SET DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 2) PDF do laudo gerado pelo worker e salvo no Supabase Storage.
-- ---------------------------------------------------------------------------
ALTER TABLE "qa_results" ADD COLUMN IF NOT EXISTS "pdf_file_path" TEXT;
ALTER TABLE "qa_results" ADD COLUMN IF NOT EXISTS "pdf_file_url" TEXT;

-- ---------------------------------------------------------------------------
-- 3) Vocabulário de status: normaliza para maiúsculas e habilita 'PROCESSANDO'.
-- ---------------------------------------------------------------------------
UPDATE "qa_results" SET "status" = 'CONCLUIDO' WHERE "status" = 'concluido';
UPDATE "qa_results" SET "status" = 'FALHA' WHERE "status" = 'falha';

ALTER TABLE "qa_results" ALTER COLUMN "status" SET DEFAULT 'PROCESSANDO';

ALTER TABLE "qa_results" DROP CONSTRAINT IF EXISTS "qa_results_status_check";
ALTER TABLE "qa_results" ADD CONSTRAINT "qa_results_status_check"
  CHECK ("status" IN ('PROCESSANDO', 'CONCLUIDO', 'FALHA'));

CREATE INDEX IF NOT EXISTS "qa_results_status_idx" ON "qa_results"("status");

-- ---------------------------------------------------------------------------
-- 4) Supabase Realtime — expõe o UPDATE completo (old + new) para a UI.
-- ---------------------------------------------------------------------------
ALTER TABLE public.qa_results REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'qa_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_results;
  END IF;
END $$;

-- RLS: SELECT para usuários autenticados é exigido pelo Realtime (o cliente
-- do navegador assina com a anon/authenticated key).
DROP POLICY IF EXISTS "security_qa_results_select_auth" ON public.qa_results;
CREATE POLICY "security_qa_results_select_auth"
  ON public.qa_results FOR SELECT TO authenticated USING (true);
