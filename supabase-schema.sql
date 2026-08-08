-- ============================================
-- CyberITSM SPN - Database Schema for Supabase
-- ============================================
-- Execute this SQL in the Supabase SQL Editor
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop triggers if they exist to avoid errors
DROP TRIGGER IF EXISTS trigger_users_profiles_updated_at ON public.users_profiles;
DROP TRIGGER IF EXISTS trigger_tickets_updated_at ON public.tickets;
DROP TRIGGER IF EXISTS trigger_ticket_statuses_updated_at ON public.ticket_statuses;
DROP TRIGGER IF EXISTS trigger_comments_updated_at ON public.comments;
DROP TRIGGER IF EXISTS trigger_iam_providers_updated_at ON public.iam_providers;
DROP TRIGGER IF EXISTS trigger_iam_users_updated_at ON public.iam_users;
DROP TRIGGER IF EXISTS trigger_identity_requests_updated_at ON public.identity_requests;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trigger_ticket_closed ON public.tickets;
DROP TRIGGER IF EXISTS trigger_sprints_updated_at ON public.sprints;
DROP TRIGGER IF EXISTS trigger_notification_settings_updated_at ON public.notification_settings;
DROP TRIGGER IF EXISTS trigger_security_requirements_updated_at ON public.security_requirements;
DROP TRIGGER IF EXISTS trigger_integration_connections_updated_at ON public.integration_connections;
DROP TRIGGER IF EXISTS trigger_mtls_configs_updated_at ON public.mtls_configs;
DROP TRIGGER IF EXISTS trigger_enterprise_tools_updated_at ON public.enterprise_tools;

-- Drop tables if they exist to ensure clean state (in order of dependencies)
DROP TABLE IF EXISTS public.enterprise_tools CASCADE;
DROP TABLE IF EXISTS public.integration_connections CASCADE;
DROP TABLE IF EXISTS public.mtls_configs CASCADE;
DROP TABLE IF EXISTS public.notification_settings CASCADE;
DROP TABLE IF EXISTS public.sprints CASCADE;
DROP TABLE IF EXISTS public.security_requirements CASCADE;
DROP TABLE IF EXISTS public.identity_requests CASCADE;
DROP TABLE IF EXISTS public.iam_users CASCADE;
DROP TABLE IF EXISTS public.iam_providers CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.ticket_statuses CASCADE;
DROP TABLE IF EXISTS public.users_profiles CASCADE;

-- Shared helper function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 1. USERS_PROFILES TABLE (linked to auth.users)
-- ============================================

CREATE TABLE public.users_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'solicitante' CHECK (role IN ('admin', 'analista', 'solicitante')),
  avatar_url TEXT,
  mfa_secret TEXT,
  mfa_setup_complete BOOLEAN NOT NULL DEFAULT FALSE,
  reset_token TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  -- Federated Identity (Identity Providers): OAuth / SAML 2.0 / SCIM
  idp_provider TEXT,
  idp_external_id TEXT,
  idp_issued_at TIMESTAMPTZ,
  idp_last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Um usuário externo só pode ser vinculado uma única vez por IdP.
  UNIQUE (idp_provider, idp_external_id)
);

-- Index for faster lookups
CREATE INDEX idx_users_profiles_email ON public.users_profiles(email);
CREATE INDEX idx_users_profiles_role ON public.users_profiles(role);
CREATE INDEX idx_users_profiles_idp ON public.users_profiles(idp_provider, idp_external_id);

CREATE TRIGGER trigger_users_profiles_updated_at
  BEFORE UPDATE ON public.users_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 2. TICKET_STATUSES TABLE (Kanban Columns)
-- ============================================

CREATE TABLE public.ticket_statuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_statuses_position ON public.ticket_statuses(position);

CREATE TRIGGER trigger_ticket_statuses_updated_at
  BEFORE UPDATE ON public.ticket_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 3. TICKETS TABLE (Chamados)
-- ============================================

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'TAREFA' CHECK (type IN ('EPICO', 'ATIVIDADE', 'TAREFA')),
  status TEXT NOT NULL REFERENCES public.ticket_statuses(id) ON UPDATE CASCADE,
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'critica')),
  assignee TEXT NOT NULL DEFAULT 'Não atribuído',
  parent_epic_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  framework_origem TEXT CHECK (framework_origem IN ('NIST', 'CIS', 'SABSA', 'ISO', 'LGPD', 'PCI-DSS')),
  dominio_framework TEXT,
  assignee_id UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  compliance_frameworks TEXT[] DEFAULT '{}',
  due_date TIMESTAMPTZ,
  sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_type ON public.tickets(type);
CREATE INDEX idx_tickets_parent_epic_id ON public.tickets(parent_epic_id);
CREATE INDEX idx_tickets_priority ON public.tickets(priority);
CREATE INDEX idx_tickets_framework_origem ON public.tickets(framework_origem);
CREATE INDEX idx_tickets_assignee_id ON public.tickets(assignee_id);
CREATE INDEX idx_tickets_reporter_id ON public.tickets(reporter_id);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX idx_tickets_sprint_id ON public.tickets(sprint_id);
CREATE INDEX idx_tickets_due_date ON public.tickets(due_date);

-- Trigger for updated_at
CREATE TRIGGER trigger_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 4. SPRINTS TABLE (Iterações de entrega)
-- ============================================

CREATE TABLE public.sprints (
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

CREATE INDEX idx_sprints_status ON public.sprints(status);
CREATE INDEX idx_sprints_start_date ON public.sprints(start_date);

CREATE TRIGGER trigger_sprints_updated_at
  BEFORE UPDATE ON public.sprints
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 5. NOTIFICATION_SETTINGS TABLE (Preferências)
-- ============================================

CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'in_app', 'sms')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_type, channel)
);

CREATE TRIGGER trigger_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 6. SECURITY_REQUIREMENTS TABLE (Matriz dinâmica)
--    Requisitos customizados/adicionados pela governança (ADMIN).
-- ============================================

CREATE TABLE public.security_requirements (
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

CREATE INDEX idx_security_requirements_criticidade ON public.security_requirements(criticidade);
CREATE INDEX idx_security_requirements_componente ON public.security_requirements(componente);

CREATE TRIGGER trigger_security_requirements_updated_at
  BEFORE UPDATE ON public.security_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 7. COMMENTS TABLE
-- ============================================

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_ticket_id ON public.comments(ticket_id);
CREATE INDEX idx_comments_created_at ON public.comments(created_at ASC);

CREATE TRIGGER trigger_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 5. AUDIT_LOGS TABLE
-- ============================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);


-- ============================================
-- 6. IAM_PROVIDERS TABLE (IAM Configs)
-- ============================================

CREATE TABLE public.iam_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entra_id', 'keycloak', 'oam', 'sailpoint', 'local')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_iam_providers_updated_at
  BEFORE UPDATE ON public.iam_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 7. IAM_USERS TABLE (Simulated users imported)
-- ============================================

CREATE TABLE public.iam_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id TEXT NOT NULL REFERENCES public.iam_providers(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  department TEXT,
  role TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, external_id)
);

CREATE INDEX idx_iam_users_email ON public.iam_users(email);
CREATE INDEX idx_iam_users_provider ON public.iam_users(provider_id);

CREATE TRIGGER trigger_iam_users_updated_at
  BEFORE UPDATE ON public.iam_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 8. IDENTITY_REQUESTS TABLE (Sailpoint Approval Requests)
-- ============================================

CREATE TABLE public.identity_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES public.iam_providers(id) ON DELETE CASCADE,
  target_user_email TEXT NOT NULL,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('admin', 'analista', 'solicitante')),
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'provisionado')),
  approver_id UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_identity_requests_status ON public.identity_requests(status);
CREATE INDEX idx_identity_requests_requester ON public.identity_requests(requester_id);

CREATE TRIGGER trigger_identity_requests_updated_at
  BEFORE UPDATE ON public.identity_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 9. INTEGRATION_CONNECTIONS TABLE (OAuth / SAML / SCIM)
-- ============================================

CREATE TABLE public.integration_connections (
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

CREATE INDEX idx_integration_connections_protocol ON public.integration_connections(protocol);

CREATE TRIGGER trigger_integration_connections_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 10. MTLS_CONFIGS TABLE (Mutual TLS global config)
-- ============================================

CREATE TABLE public.mtls_configs (
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

CREATE TRIGGER trigger_mtls_configs_updated_at
  BEFORE UPDATE ON public.mtls_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 11. ENTERPRISE_TOOLS TABLE (Jira / ServiceNow / Office 365)
-- ============================================

CREATE TABLE public.enterprise_tools (
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

CREATE INDEX idx_enterprise_tools_type ON public.enterprise_tools(tool_type);

CREATE TRIGGER trigger_enterprise_tools_updated_at
  BEFORE UPDATE ON public.enterprise_tools
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iam_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iam_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mtls_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_tools ENABLE ROW LEVEL SECURITY;

-- users_profiles policies
CREATE POLICY "Users can view own profile" ON public.users_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.users_profiles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can update all profiles" ON public.users_profiles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert profiles" ON public.users_profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
-- Enable public profiles read for auth triggers and users linking
CREATE POLICY "All authenticated can view profiles" ON public.users_profiles FOR SELECT TO authenticated USING (true);

-- ticket_statuses policies
CREATE POLICY "All authenticated can view statuses" ON public.ticket_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage statuses" ON public.ticket_statuses FOR ALL TO authenticated USING (public.is_admin());

-- tickets policies
CREATE POLICY "Users can view own tickets" ON public.tickets FOR SELECT TO authenticated USING (
  auth.uid() = reporter_id OR auth.uid() = assignee_id OR public.is_admin_or_analista()
);
CREATE POLICY "Users can create tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Reporters can update own tickets" ON public.tickets FOR UPDATE TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "Assignees can update assigned tickets" ON public.tickets FOR UPDATE TO authenticated USING (auth.uid() = assignee_id);
CREATE POLICY "Admins and Analistas can update any ticket" ON public.tickets FOR UPDATE TO authenticated USING (public.is_admin_or_analista());
CREATE POLICY "Admins can delete tickets" ON public.tickets FOR DELETE TO authenticated USING (public.is_admin());

-- sprints policies
CREATE POLICY "Authenticated can view sprints" ON public.sprints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage sprints" ON public.sprints FOR ALL TO authenticated USING (public.is_admin());

-- notification_settings policies
CREATE POLICY "Authenticated can view notification settings" ON public.notification_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage notification settings" ON public.notification_settings FOR ALL TO authenticated USING (public.is_admin());

-- security_requirements policies
CREATE POLICY "Authenticated can view security requirements" ON public.security_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage security requirements" ON public.security_requirements FOR ALL TO authenticated USING (public.is_admin());

-- comments policies
CREATE POLICY "Authenticated can view comments" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Authors/Admins can delete comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.is_admin());

-- audit_logs policies
CREATE POLICY "Only admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "System/Users can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- iam_providers policies
CREATE POLICY "Authenticated can view providers" ON public.iam_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage providers" ON public.iam_providers FOR ALL TO authenticated USING (public.is_admin());

-- iam_users policies
CREATE POLICY "Authenticated can view iam users" ON public.iam_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins/analistas can manage iam users" ON public.iam_users FOR ALL TO authenticated USING (public.is_admin_or_analista());

-- identity_requests policies
CREATE POLICY "Authenticated can view identity requests" ON public.identity_requests FOR SELECT TO authenticated USING (
  auth.uid() = requester_id OR public.is_admin_or_analista()
);
CREATE POLICY "Authenticated can create identity requests" ON public.identity_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Only admins/analistas can update requests" ON public.identity_requests FOR UPDATE TO authenticated USING (public.is_admin_or_analista());

-- integration_connections policies
CREATE POLICY "Authenticated can view connections" ON public.integration_connections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage connections" ON public.integration_connections FOR ALL TO authenticated USING (public.is_admin());

-- mtls_configs policies
CREATE POLICY "Authenticated can view mtls config" ON public.mtls_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage mtls config" ON public.mtls_configs FOR ALL TO authenticated USING (public.is_admin());

-- enterprise_tools policies
CREATE POLICY "Authenticated can view enterprise tools" ON public.enterprise_tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage enterprise tools" ON public.enterprise_tools FOR ALL TO authenticated USING (public.is_admin());


-- ============================================
-- 13. HELPER FUNCTIONS & TRIGGERS
-- ============================================

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'solicitante')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Helper role-check functions (SECURITY DEFINER -> bypass RLS -> avoid infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.users_profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_analista()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.users_profiles WHERE id = auth.uid() AND role = 'analista');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_analista()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.users_profiles WHERE id = auth.uid() AND role IN ('admin', 'analista'));
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_analista() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_analista() TO authenticated;

-- Function to set closed_at when status changes to 'fechado'
CREATE OR REPLACE FUNCTION public.handle_ticket_closed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'fechado' AND OLD.status != 'fechado' THEN
    NEW.closed_at = NOW();
  ELSIF NEW.status != 'fechado' THEN
    NEW.closed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_ticket_closed
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ticket_closed();


-- ============================================
-- 14. INITIAL SEED DATA
-- ============================================

-- Seed default ticket statuses
INSERT INTO public.ticket_statuses (id, name, color, position, is_default) VALUES
  ('ABERTO', 'Aberto', '#3b82f6', 1, true),
  ('EM_ANDAMENTO', 'Em Andamento', '#f59e0b', 2, false),
  ('BLOQUEADO', 'Bloqueado', '#ef4444', 3, false),
  ('FECHADO', 'Fechado', '#10b981', 4, false),
  ('CANCELADO', 'Cancelado', '#64748b', 5, false)
ON CONFLICT (id) DO NOTHING;

-- Seed default IAM providers
INSERT INTO public.iam_providers (id, name, type, config, is_active) VALUES
  ('entra_id', 'Microsoft Entra ID', 'entra_id', '{"sync_interval": "daily"}'::jsonb, true),
  ('keycloak', 'Keycloak Broker', 'keycloak', '{"realm": "cyberitsm"}'::jsonb, true),
  ('oam', 'Oracle Access Manager', 'oam', '{"sso_header": "OAM_REMOTE_USER"}'::jsonb, true),
  ('sailpoint', 'Sailpoint IdentityNow', 'sailpoint', '{"governance_enabled": true}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- Seed default notification settings
INSERT INTO public.notification_settings (event_type, channel, enabled, description) VALUES
  ('ticket_created', 'email', true, 'Notificação por e-mail quando um novo chamado é criado'),
  ('ticket_updated', 'email', true, 'Notificação por e-mail quando um chamado é atualizado'),
  ('due_date', 'email', true, 'Alerta por e-mail de proximidade/estouro da data de vencimento (due date)'),
  ('sprint_start', 'email', true, 'Notificação por e-mail quando uma sprint entra em execução')
ON CONFLICT (event_type, channel) DO NOTHING;

-- Seed default integration connections (OAuth / SAML / SCIM)
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

-- Seed default global mTLS config (single row singleton)
INSERT INTO public.mtls_configs (id, enabled, require_client_cert) VALUES
  ('global', false, true)
ON CONFLICT (id) DO NOTHING;

-- Seed default enterprise tool integrations
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
-- 15. GRANTS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.users_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT ON public.ticket_statuses TO authenticated;
GRANT SELECT ON public.sprints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sprints TO authenticated;
GRANT SELECT ON public.notification_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT SELECT ON public.security_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.iam_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iam_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.identity_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mtls_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_tools TO authenticated;

-- ============================================
-- AUDIT RETENTION (arquivo comprimido + consentimento de expurgo)
-- Política: HOT 0-7d (audit_logs) · ARCHIVE 7-90d (GZIP por dia) ·
--           PURGE >90d somente com consentimento de marcus.goncalves.
-- ============================================

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

-- ============================================
-- END OF SCHEMA
-- ============================================