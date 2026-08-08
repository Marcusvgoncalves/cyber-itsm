-- ============================================
-- CyberITSM SPN - Migration Incremental (safe, non-destructive)
-- Adiciona apenas o que falta no banco existente:
--   * Tabelas novas: sprints, notification_settings, security_requirements,
--     integration_connections, mtls_configs, enterprise_tools
--   * Colunas novas em tickets (due_date, sprint_id) e
--     users_profiles (idp_provider, idp_external_id, idp_issued_at, idp_last_sync)
--   * RLS, policies, grants e seed data para os itens acima
-- Pode ser executado mais de uma vez (idempotente).
-- ============================================

-- 1. NOVAS TABELAS ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  goal TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PLANEJADA' CHECK (status IN ('PLANEJADA', 'ATIVA', 'CONCLUIDA')),
  created_by UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sprints_status ON public.sprints(status);
CREATE INDEX IF NOT EXISTS idx_sprints_start_date ON public.sprints(start_date);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sprints_updated_at' AND tgrelid = 'public.sprints'::regclass) THEN
    CREATE TRIGGER trigger_sprints_updated_at
      BEFORE UPDATE ON public.sprints
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'in_app', 'sms')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_type, channel)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notification_settings_updated_at' AND tgrelid = 'public.notification_settings'::regclass) THEN
    CREATE TRIGGER trigger_notification_settings_updated_at
      BEFORE UPDATE ON public.notification_settings
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.security_requirements (
  id TEXT PRIMARY KEY,
  controle TEXT NOT NULL,
  detalhamento TEXT,
  componente TEXT,
  propriedade TEXT,
  stride_lm TEXT,
  riscos TEXT,
  owasp TEXT,
  categoria TEXT,
  criticidade TEXT NOT NULL DEFAULT 'Moderado',
  tipo_controle TEXT,
  evidencia TEXT,
  como_testar TEXT,
  custom BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_requirements_criticidade ON public.security_requirements(criticidade);
CREATE INDEX IF NOT EXISTS idx_security_requirements_componente ON public.security_requirements(componente);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_security_requirements_updated_at' AND tgrelid = 'public.security_requirements'::regclass) THEN
    CREATE TRIGGER trigger_security_requirements_updated_at
      BEFORE UPDATE ON public.security_requirements
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('oauth2', 'saml', 'scim')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_status TEXT,
  last_tested_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_protocol ON public.integration_connections(protocol);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_integration_connections_updated_at' AND tgrelid = 'public.integration_connections'::regclass) THEN
    CREATE TRIGGER trigger_integration_connections_updated_at
      BEFORE UPDATE ON public.integration_connections
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mtls_configs (
  id TEXT PRIMARY KEY DEFAULT 'global',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ca_cert TEXT,
  client_cert TEXT,
  client_key TEXT,
  require_client_cert BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_mtls_configs_updated_at' AND tgrelid = 'public.mtls_configs'::regclass) THEN
    CREATE TRIGGER trigger_mtls_configs_updated_at
      BEFORE UPDATE ON public.mtls_configs
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.enterprise_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  tool_type TEXT NOT NULL CHECK (tool_type IN ('jira', 'servicenow', 'office365')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_status TEXT,
  last_tested_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_tools_type ON public.enterprise_tools(tool_type);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_enterprise_tools_updated_at' AND tgrelid = 'public.enterprise_tools'::regclass) THEN
    CREATE TRIGGER trigger_enterprise_tools_updated_at
      BEFORE UPDATE ON public.enterprise_tools
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- 2. NOVAS COLUNAS EM TABELAS EXISTENTES ----------------------------

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_sprint_id ON public.tickets(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tickets_due_date ON public.tickets(due_date);

ALTER TABLE public.users_profiles
  ADD COLUMN IF NOT EXISTS idp_provider TEXT,
  ADD COLUMN IF NOT EXISTS idp_external_id TEXT,
  ADD COLUMN IF NOT EXISTS idp_issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idp_last_sync TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_profiles_idp ON public.users_profiles(idp_provider, idp_external_id);

-- 3. RLS + POLICIES NAS NOVAS TABELAS -------------------------------

ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mtls_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_tools ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sprints' AND policyname='Authenticated can view sprints') THEN
    CREATE POLICY "Authenticated can view sprints" ON public.sprints FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sprints' AND policyname='Only admins can manage sprints') THEN
    CREATE POLICY "Only admins can manage sprints" ON public.sprints FOR ALL TO authenticated USING (public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_settings' AND policyname='Authenticated can view notification settings') THEN
    CREATE POLICY "Authenticated can view notification settings" ON public.notification_settings FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_settings' AND policyname='Only admins can manage notification settings') THEN
    CREATE POLICY "Only admins can manage notification settings" ON public.notification_settings FOR ALL TO authenticated USING (public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='security_requirements' AND policyname='Authenticated can view security requirements') THEN
    CREATE POLICY "Authenticated can view security requirements" ON public.security_requirements FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='security_requirements' AND policyname='Only admins can manage security requirements') THEN
    CREATE POLICY "Only admins can manage security requirements" ON public.security_requirements FOR ALL TO authenticated USING (public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='integration_connections' AND policyname='Authenticated can view connections') THEN
    CREATE POLICY "Authenticated can view connections" ON public.integration_connections FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='integration_connections' AND policyname='Only admins can manage connections') THEN
    CREATE POLICY "Only admins can manage connections" ON public.integration_connections FOR ALL TO authenticated USING (public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mtls_configs' AND policyname='Authenticated can view mtls config') THEN
    CREATE POLICY "Authenticated can view mtls config" ON public.mtls_configs FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mtls_configs' AND policyname='Only admins can manage mtls config') THEN
    CREATE POLICY "Only admins can manage mtls config" ON public.mtls_configs FOR ALL TO authenticated USING (public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enterprise_tools' AND policyname='Authenticated can view enterprise tools') THEN
    CREATE POLICY "Authenticated can view enterprise tools" ON public.enterprise_tools FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enterprise_tools' AND policyname='Only admins can manage enterprise tools') THEN
    CREATE POLICY "Only admins can manage enterprise tools" ON public.enterprise_tools FOR ALL TO authenticated USING (public.is_admin());
  END IF;
END $$;

-- 4. GRANTS ----------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.sprints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sprints TO authenticated;
GRANT SELECT ON public.notification_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT SELECT ON public.security_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mtls_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_tools TO authenticated;

-- 5. SEED DATA (novos objetos) ---------------------------------------

INSERT INTO public.notification_settings (event_type, channel, enabled, description) VALUES
  ('ticket_created', 'email', true, 'Notificação por e-mail quando um novo chamado é criado'),
  ('ticket_updated', 'email', true, 'Notificação por e-mail quando um chamado é atualizado'),
  ('due_date', 'email', true, 'Alerta por e-mail de proximidade/estouro da data de vencimento (due date)'),
  ('sprint_start', 'email', true, 'Notificação por e-mail quando uma sprint entra em execução')
ON CONFLICT (event_type, channel) DO NOTHING;

INSERT INTO public.integration_connections (name, protocol, config, is_active, last_status) VALUES
  (
    'Microsoft Entra ID (OAuth 2.0)',
    'oauth2',
    '{"authorization_url": "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize", "token_url": "https://login.microsoftonline.com/organizations/oauth2/v2.0/token", "client_id": "", "scopes": ["openid", "profile", "email"], "grant_type": "authorization_code"}'::jsonb,
    true,
    'nunca testado'
  ),
  (
    'Microsoft Entra ID (SAML 2.0)',
    'saml',
    '{"idp_entity_id": "https://sts.windows.net/cyberitsm/", "sso_url": "https://login.microsoftonline.com/cyberitsm/saml2", "sp_entity_id": "https://cyber-itsm.vercel.app/api/saml/metadata", "acs_url": "https://cyber-itsm.vercel.app/api/saml/sso", "name_id_format": "emailAddress"}'::jsonb,
    true,
    'nunca testado'
  ),
  (
    'SCIM v2.0 Provisioning',
    'scim',
    '{"base_url": "https://cyber-itsm.vercel.app/api/scim/v2/Users", "provisioning_direction": "inbound", "group_sync": true, "bearer_token": ""}'::jsonb,
    true,
    'nunca testado'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mtls_configs (id, enabled, require_client_cert) VALUES
  ('global', false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.enterprise_tools (name, tool_type, config, is_active, last_status) VALUES
  (
    'Jira Software (Gestão de Demandas)',
    'jira',
    '{"base_url": "", "email": "", "api_token": "", "project_key": "", "issue_type": "Task"}'::jsonb,
    true,
    'nunca testado'
  ),
  (
    'ServiceNow (ITSM)',
    'servicenow',
    '{"instance_url": "", "client_id": "", "client_secret": "", "table": "incident"}'::jsonb,
    true,
    'nunca testado'
  ),
  (
    'Microsoft 365 / Office 365',
    'office365',
    '{"tenant_id": "", "client_id": "", "client_secret": "", "graph_endpoint": "https://graph.microsoft.com/v1.0"}'::jsonb,
    true,
    'nunca testado'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- END OF INCREMENTAL MIGRATION
-- ============================================
