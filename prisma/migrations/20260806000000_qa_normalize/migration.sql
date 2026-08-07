-- ============================================================================
-- Normalização do módulo Centro de Security QA
-- Cria as tabelas qa_projects + qa_results (banco novo) OU migra a tabela
-- legada qa_results (criada via supabase-security-qa.sql) para a estrutura
-- normalizada, preservando todos os registros existentes.
-- Idempotente: seguro rodar em banco novo ou legado.
-- ============================================================================

-- CreateTable: qa_projects
CREATE TABLE IF NOT EXISTS "qa_projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "environment_url" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qa_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable: qa_results (banco novo; em banco legado já existe)
CREATE TABLE IF NOT EXISTS "qa_results" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "temp_storage_path" TEXT,
    "archived_file_path" TEXT NOT NULL,
    "archived_file_url" TEXT,
    "archived_size_bytes" BIGINT NOT NULL,
    "original_size_bytes" BIGINT NOT NULL,
    "compression_ratio" DECIMAL(10,4),
    "compliance_percent" DECIMAL(5,2) NOT NULL,
    "overall_rating" TEXT NOT NULL,
    "executive_summary" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'concluido',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qa_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "qa_projects_name_key" ON "qa_projects"("name");
CREATE INDEX IF NOT EXISTS "qa_results_project_id_idx" ON "qa_results"("project_id");
CREATE INDEX IF NOT EXISTS "qa_results_created_at_idx" ON "qa_results"("created_at" DESC);

-- ============================================================================
-- Migração de dados legados (backfill) — preserva registros existentes.
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='qa_results'
          AND column_name='project_name'
    ) THEN
        -- 1) Materializa um QaProject por projeto já avaliado (dedup).
        INSERT INTO "qa_projects" ("id","name","environment_url","requirements","created_by","created_at","updated_at")
        SELECT
            gen_random_uuid(),
            dedup.project_name,
            dedup.environment_url,
            dedup.requirements,
            dedup.created_by,
            now(),
            now()
        FROM (
            SELECT DISTINCT ON (project_name)
                project_name,
                environment_url,
                requirements,
                created_by
            FROM "qa_results"
            ORDER BY project_name, created_at DESC
        ) dedup
        ON CONFLICT ("name") DO NOTHING;

        -- 2) Adiciona project_id (data migration) e vincula resultados.
        ALTER TABLE "qa_results" ADD COLUMN IF NOT EXISTS "project_id" UUID;
        UPDATE "qa_results" r
        SET "project_id" = p."id"
        FROM "qa_projects" p
        WHERE r.project_name = p.name;

        -- 3) Remove colunas agora normalizadas em qa_projects.
        ALTER TABLE "qa_results" DROP COLUMN IF EXISTS "project_name";
        ALTER TABLE "qa_results" DROP COLUMN IF EXISTS "environment_url";
        ALTER TABLE "qa_results" DROP COLUMN IF EXISTS "requirements";
        ALTER TABLE "qa_results" DROP COLUMN IF EXISTS "created_by";

        -- 4) Indexa a nova coluna.
        CREATE INDEX IF NOT EXISTS "qa_results_project_name_legacy_idx"
            ON "qa_results"("project_id");
    END IF;
END $$;

-- Encerra: garante project_id cobrido (não nulo) e FK.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='qa_results'
          AND column_name='project_id'
    ) THEN
        ALTER TABLE "qa_results" ALTER COLUMN "project_id" SET NOT NULL;
    END IF;
END $$;

ALTER TABLE "qa_results" DROP CONSTRAINT IF EXISTS "qa_results_project_id_fkey";
ALTER TABLE "qa_results" ADD CONSTRAINT "qa_results_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "qa_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;