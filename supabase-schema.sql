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

-- Drop tables if they exist to ensure clean state (in order of dependencies)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_type ON public.tickets(type);
CREATE INDEX idx_tickets_parent_epic_id ON public.tickets(parent_epic_id);
CREATE INDEX idx_tickets_priority ON public.tickets(priority);
CREATE INDEX idx_tickets_priority ON public.tickets(priority);
CREATE INDEX idx_tickets_framework_origem ON public.tickets(framework_origem);
CREATE INDEX idx_tickets_assignee_id ON public.tickets(assignee_id);
CREATE INDEX idx_tickets_reporter_id ON public.tickets(reporter_id);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER trigger_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 4. COMMENTS TABLE
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
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iam_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iam_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_requests ENABLE ROW LEVEL SECURITY;

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


-- ============================================
-- 10. HELPER FUNCTIONS & TRIGGERS
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
-- 11. INITIAL SEED DATA
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


-- ============================================
-- 12. GRANTS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.users_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT ON public.ticket_statuses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.iam_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iam_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.identity_requests TO authenticated;

-- ============================================
-- END OF SCHEMA
-- ============================================