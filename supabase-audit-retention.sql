-- ============================================================
-- CyberITSM — Política de Retenção de Logs de Auditoria
-- ------------------------------------------------------------
-- HOT (0-7d):        public.audit_logs (consultável na UI)
-- ARCHIVE (7-90d):   public.audit_logs_archive (GZIP por dia)
-- PURGE (>90d):      somente com consentimento de marcus.goncalves
--                    registrado em public.audit_purge_consent.
-- ------------------------------------------------------------
-- Aplicar com o client do Supabase (SQL Editor) ou psql.
-- ============================================================

DROP TABLE IF EXISTS public.audit_purge_consent CASCADE;
DROP TABLE IF EXISTS public.audit_logs_archive CASCADE;

-- Arquivo frio: logs comprimidos por dia (GZIP) — storage mínima.
CREATE TABLE public.audit_logs_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  archive_day DATE NOT NULL UNIQUE,
  payload_gz BYTEA NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  original_bytes BIGINT NOT NULL DEFAULT 0,
  compressed_bytes BIGINT NOT NULL DEFAULT 0,
  compression_ratio NUMERIC(6,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purged_at TIMESTAMPTZ
);
CREATE INDEX idx_audit_archive_purged_at ON public.audit_logs_archive(purged_at);

-- Consentimento de expurgo (somente marcus.goncalves pode conceder).
CREATE TABLE public.audit_purge_consent (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consented_by_email TEXT NOT NULL,
  consented_by_user_id UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'GRANTED'
    CHECK (status IN ('GRANTED', 'REVOKED', 'EXECUTED')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);
CREATE INDEX idx_audit_consent_email ON public.audit_purge_consent(consented_by_email);

ALTER TABLE public.audit_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_purge_consent ENABLE ROW LEVEL SECURITY;

-- RLS: somente admins visualizam arquivo e consentimentos.
CREATE POLICY "Only admins can view audit archive"
  ON public.audit_logs_archive FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Only admins can view purge consent"
  ON public.audit_purge_consent FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Only admins can grant purge consent"
  ON public.audit_purge_consent FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Only admins can update purge consent"
  ON public.audit_purge_consent FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Only admins can delete purge consent"
  ON public.audit_purge_consent FOR DELETE TO authenticated USING (public.is_admin());

GRANT SELECT ON public.audit_logs_archive TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_purge_consent TO authenticated;
