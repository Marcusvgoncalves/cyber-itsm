# Documentação Oficial / Official Documentation - CyberITSM

Este documento detalha as especificações técnicas, arquitetura e processos do sistema **CyberITSM** rebuild em Ruby.

---

## 🇧🇷 Português - Especificação Técnica

### 1. Visão Geral do Sistema
O **CyberITSM** é um sistema de Gerenciamento de Serviços de TI (ITSM) especializado em **Arquitetura de Cibersegurança**. O projeto implementa um fluxo visual Kanban inspirado no Jira da Atlassian, permitindo que analistas e arquitetos gerenciem chamados correlacionados com frameworks internacionais de segurança da informação (NIST CSF, CIS Controls, ISO/IEC 27001 e SABSA).

### 2. Arquitetura do Software (C4 Model)
A arquitetura foi redesenhada utilizando a linguagem **Ruby** e o framework web lightweight **Sinatra** com servidor **Puma**, persistindo informações de maneira estruturada no banco de dados **SQLite3** através do **ActiveRecord ORM**.
- **Frontend**: Aplicação de Página Única (SPA) com HTML5, CSS customizado seguindo o design system **Mistica da Vivo Telefônica** (paleta roxa e tipografia Outfit) e interações dinâmicas em Javascript.
- **Backend API**: Rotas Sinatra REST que lidam com ações no Kanban, gerenciamento dinâmico de status (criar, ordenar, deletar status), comentários e trilhas imutáveis de auditoria.
- **Persistência**: SQLite3 gerido por migrações ActiveRecord.

### 3. Modelo de Status do Kanban (Estilo Jira)
Ao contrário do modelo estático, os status do fluxo de trabalho no Kanban são totalmente dinâmicos:
- O administrador pode criar novos status associando-os a uma categoria de progresso (`todo`, `in_progress`, `done`).
- Os status podem ser reordenados sequencialmente (alterando a ordem visual das colunas no quadro).
- Ao excluir um status, todos os chamados ativos associados a ele são automaticamente transferidos pelo banco de dados em uma transação segura para o primeiro status disponível, prevenindo chamados órfãos.

### 4. Cores e Identidade Visual (Mistica Vivo)
Os estilos seguem rigorosamente a paleta de cores da **Vivo Telefônica**:
- **Roxo Vivo (Primary)**: `#660099` como cor de botões de ação e marca.
- **Laranja (Accent/Warning)**: `#FF9900` para destaques.
- **Dark Mode**: Fundo em `#0F0F1A`, cartões em `#1E1E2F` e bordas finas em `#2D2D44`.

### 5. Suite de Testes & Segurança (SAST/DAST/SCA)
- **Testes Unitários & Integração**: Escritos com **RSpec** e **Rack::Test** em `spec/app_spec.rb`, cobrindo as rotas REST, fluxo de transição e regras de auditoria.
- **SCA**: Executado via `bundler-audit` para inspecionar vulnerabilidades em Gems do Ruby.
- **SAST**: Executado através do `brakeman` e `rubocop` para análise estática de código e boas práticas de segurança.
- **DAST**: Implementado via `scripts/security_scan.rb`, que levanta o servidor em porta de teste e envia payloads reais verificando a presença de cabeçalhos de proteção HTTP contra XSS, Clickjacking, e valida a sanitização contra SQL Injection.

---

## 🇺🇸 English - Technical Specification

### 1. System Overview
**CyberITSM** is an IT Service Management (ITSM) system focused on **Cybersecurity Architecture**. The project implements a visual Kanban board workflow modeled after Atlassian's Jira, enabling security architects to manage tickets linked to international compliance standards (NIST CSF, CIS Controls, ISO/IEC 27001, and SABSA).

### 2. Software Architecture (C4 Model)
The software has been rebuilt using the **Ruby** language and the lightweight web framework **Sinatra** running on a **Puma** web server, persisting data via the **ActiveRecord ORM** into a **SQLite3** database.
- **Frontend**: A Single Page Application (SPA) leveraging HTML5, Javascript, and a custom CSS implementation of **Telefonica's Mistica** design system (Vivo purple color palette, Outfit typography).
- **Backend API**: Sinatra REST endpoints handling Kanban movements, dynamic status management (create, delete, reorder), comments, and immutable audit logging.
- **Persistence**: SQLite3 database schema governed by ActiveRecord migrations.

### 3. Jira-Style Kanban Status Model
Status columns on the Kanban board are fully manageable:
- Administrators can register new statuses and map them to one of three progress categories (`todo`, `in_progress`, `done`).
- Statuses can be reordered sequentially, immediately modifying column order on the UI.
- Deleting a status triggers an ActiveRecord database transaction that safely reassigns all affected tickets to a fallback status, ensuring system data integrity.

### 4. Mistica Vivo Identity & Theme
Frontend visual assets obey the official **Vivo Telefonica** design standards:
- **Vivo Purple (Primary)**: `#660099` used for action triggers and badges.
- **Orange (Accent/Highlight)**: `#FF9900` for warning labels.
- **Dark Mode**: Interface background set to `#0F0F1A`, ticket cards to `#1E1E2F`, and border frames to `#2D2D44`.

### 5. Automated Testing & Security (SAST/DAST/SCA)
- **Behavior Testing**: Implemented with **RSpec** and **Rack::Test** inside `spec/app_spec.rb`, asserting REST controllers, database states, and transaction safeguards.
- **SCA (Software Composition Analysis)**: Powered by `bundler-audit` to detect CVEs inside the Gemfile dependencies.
- **SAST (Static Application Security Testing)**: Verified with `brakeman` and `rubocop` to identify vulnerabilities and code quality issues.
- **DAST (Dynamic Application Security Testing)**: Automated in `scripts/security_scan.rb`, which boots the web server, probes active endpoints for security headers (CSP, X-Frame-Options, etc.), and tests input validation against SQL Injections.

---

### 6. Gestão de Acessos & Perfis (IAM / IGA) - Português
A área de acessos integra simuladores de provedores líderes de mercado:
- **Microsoft Entra ID**: Conector OpenID Connect (OIDC) que simula o fluxo de importação e sincronização de usuários SecOps baseados em escopos corporativos.
- **Keycloak**: Gerencia Realms e credenciais de cliente OIDC para controle fino e RBAC local.
- **Oracle Access Manager (OAM)**: Integração com cabeçalhos de identificação WebGate e identificadores únicos.
- **Sailpoint IdentityNow (IGA)**: Implementa a trilha de governança. O provisionamento de usuários segue um ciclo de vida estrito: solicitação de acesso, aprovação pelo gestor de SecOps e provisionamento ativo (gravação do perfil local e atualização dos conectores).

---

### 6. Identity & Access Governance (IAM / IGA) - English
The access panel simulates state-of-the-art Identity and Access Management connectors:
- **Microsoft Entra ID**: OIDC client connector simulating synchronization and extraction of enterprise SecOps identity logs.
- **Keycloak**: Real-time management of realm mappings and OIDC client profiles matching local RBAC.
- **Oracle Access Manager (OAM)**: Emulates gateway header attributes (WebGate Remote User) to dynamically parse user IDs.
- **Sailpoint IdentityNow (IGA)**: Implements identity governance request audits. User provisioning follows a formal transaction log: request creation, SecOps manager authorization, and final target connector provisioning (active user generation and role persistence).

