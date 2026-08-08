-- ============================================
-- CyberITSM SPN - Seed do Quadro Kanban Hierárquico
-- ============================================
-- Execute este script no Supabase SQL Editor APÓS o supabase-schema.sql
-- para popular o Kanban com Épicos, Atividades e Tarefas interligados.
--
-- A coluna `checklist` foi removida do módulo de chamados. Este script
-- também garante a remoção da coluna em bases que já a possuíam.
-- ============================================

-- 1) Migração: remove a coluna `checklist` (agora inexistente no domínio).
ALTER TABLE public.tickets DROP COLUMN IF EXISTS checklist;

-- 2) População da massa de dados inicial do Kanban.
--    As Atividades e Tarefas referenciam o `parent_epic_id` do Épico pai
--    correspondente (estrutura Jira/Scrum). IDs fixos => seed idempotente.
INSERT INTO public.tickets
  (id, title, description, type, status, priority, assignee, parent_epic_id, tags, framework_origem, created_at, updated_at, closed_at)
VALUES
  -- ==================================================================
  -- ÉPICO 1: Implementação de Pipeline DevSecOps & Conformidade
  -- ==================================================================
  (
    'a1b2c3d4-0000-4000-8000-000000000001',
    'Implementação de Pipeline DevSecOps & Conformidade',
    'Estruturar a esteira de CI/CD com gates de segurança automatizados (SAST, DAST e telemetria) para garantir conformidade contínua no ciclo de entrega de software.',
    'EPICO',
    'EM_ANDAMENTO',
    'alta',
    'Marcus Gonçalves',
    NULL,
    ARRAY['devsecops', 'ci-cd', 'conformidade']::text[],
    'NIST',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '2 days',
    NULL
  ),
  -- Atividade 1.1
  (
    'a1b2c3d4-0000-4000-8000-000000000011',
    'Integração de análise DAST e SAST na esteira CI/CD.',
    'Incorporar ferramentas de análise estática (SAST) e dinâmica (DAST) como etapas bloqueantes do pipeline, com publicação dos resultados em artefatos auditáveis.',
    'ATIVIDADE',
    'EM_ANDAMENTO',
    'alta',
    'Marcus Gonçalves',
    'a1b2c3d4-0000-4000-8000-000000000001',
    ARRAY['sast', 'dast', 'pipeline']::text[],
    'NIST',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '3 days',
    NULL
  ),
  -- Tarefa 1.1.1
  (
    'a1b2c3d4-0000-4000-8000-000000000111',
    'Configurar action do OWASP ZAP para scan dinâmico.',
    'Criar e parametrizar a GitHub Action do OWASP ZAP para execução do scan dinâmico contra o ambiente de staging, incluindo regras de exclusão de endpoints sensíveis.',
    'TAREFA',
    'FECHADO',
    'alta',
    'Ana Ribeiro',
    'a1b2c3d4-0000-4000-8000-000000000001',
    ARRAY['owasp-zap', 'dast']::text[],
    'NIST',
    NOW() - INTERVAL '24 days',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
  ),
  -- Tarefa 1.1.2
  (
    'a1b2c3d4-0000-4000-8000-000000000112',
    'Ajustar bloqueio de pipeline baseado em vulnerabilidades do OWASP Top 10.',
    'Configurar thresholds de severidade para falhar a pipeline quando vulnerabilidades do OWASP Top 10 forem detectadas, com política de aceite de risco via comentário aprovado.',
    'TAREFA',
    'EM_ANDAMENTO',
    'critica',
    'Marcus Gonçalves',
    'a1b2c3d4-0000-4000-8000-000000000001',
    ARRAY['owasp-top10', 'gates', 'seguranca']::text[],
    'NIST',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '1 day',
    NULL
  ),
  -- Atividade 1.2
  (
    'a1b2c3d4-0000-4000-8000-000000000012',
    'Revisão de logs e telemetria de segurança.',
    'Mapear fontes de eventos de segurança do pipeline e definir o modelo de retenção e correlação das telemetrias para trilha de auditoria.',
    'ATIVIDADE',
    'ABERTO',
    'media',
    'Caio Duarte',
    'a1b2c3d4-0000-4000-8000-000000000001',
    ARRAY['logs', 'telemetria', 'auditoria']::text[],
    'NIST',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '5 days',
    NULL
  ),
  -- Tarefa 1.2.1
  (
    'a1b2c3d4-0000-4000-8000-000000000121',
    'Criar dashboard de métricas de vulnerabilidade.',
    'Construir painel consolidado de vulnerabilidades por severidade, tempo de correção (MTTR) e cobertura de scans por aplicação.',
    'TAREFA',
    'ABERTO',
    'media',
    'Caio Duarte',
    'a1b2c3d4-0000-4000-8000-000000000001',
    ARRAY['dashboard', 'metricas']::text[],
    'NIST',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '4 days',
    NULL
  ),

  -- ==================================================================
  -- ÉPICO 2: Modernização do Identity and Access Management (IAM)
  -- ==================================================================
  (
    'a1b2c3d4-0000-4000-8000-000000000002',
    'Modernização do Identity and Access Management (IAM)',
    'Iniciativa de modernização da governança de identidade, consolidando Single Sign-On (SSO), provisionamento federado e validação de protocolos de identidade.',
    'EPICO',
    'ABERTO',
    'alta',
    'Patrícia Nogueira',
    NULL,
    ARRAY['iam', 'sso', 'identidade']::text[],
    'NIST',
    NOW() - INTERVAL '21 days',
    NOW() - INTERVAL '6 days',
    NULL
  ),
  -- Atividade 2.1
  (
    'a1b2c3d4-0000-4000-8000-000000000021',
    'Configuração de infraestrutura de Single Sign-On (SSO).',
    'Provisionar a plataforma de provedor de identidade e configurar o fluxo de autenticação única integrado ao portal CyberITSM SPN.',
    'ATIVIDADE',
    'ABERTO',
    'alta',
    'Patrícia Nogueira',
    'a1b2c3d4-0000-4000-8000-000000000002',
    ARRAY['sso', 'keycloak', 'provedor']::text[],
    'NIST',
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '6 days',
    NULL
  ),
  -- Tarefa 2.1.1
  (
    'a1b2c3d4-0000-4000-8000-000000000211',
    'Provisionar infraestrutura de provedor de identidade via Docker.',
    'Subir o container do provedor de identidade (Keycloak) em ambiente localhost, com realm e clientes pré-configurados via script de bootstrap.',
    'TAREFA',
    'FECHADO',
    'alta',
    'Rafael Mendes',
    'a1b2c3d4-0000-4000-8000-000000000002',
    ARRAY['docker', 'keycloak', 'infraestrutura']::text[],
    'NIST',
    NOW() - INTERVAL '16 days',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
  ),
  -- Tarefa 2.1.2
  (
    'a1b2c3d4-0000-4000-8000-000000000212',
    'Validar protocolos de acesso de identidade e tokens JWT.',
    'Testar fluxos OIDC/OAuth2, verificar claims mapeados e validar assinatura, expiração e escopos dos tokens JWT emitidos pelo provedor.',
    'TAREFA',
    'ABERTO',
    'alta',
    'Patrícia Nogueira',
    'a1b2c3d4-0000-4000-8000-000000000002',
    ARRAY['oidc', 'oauth2', 'jwt']::text[],
    'NIST',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '3 days',
    NULL
  )
ON CONFLICT (id) DO NOTHING;
