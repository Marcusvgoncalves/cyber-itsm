# Documentação Oficial / Official Documentation - CyberITSM

Este documento detalha as especificações técnicas, arquitetura multicamadas, integrações com microsserviços de IAM e o roteiro de próximos passos do sistema **CyberITSM** rebuild em Ruby.

---

## 🇧🇷 Português - Especificação Técnica

### 1. Visão Geral do Sistema
O **CyberITSM** é uma plataforma corporativa de gerenciamento de chamados especializada em **Arquitetura e Conformidade de Cibersegurança**. Ela implementa um fluxo visual Kanban inspirado no Jira da Atlassian, permitindo que analistas correlacionem cada ticket com controles regulatórios internacionais (NIST CSF, CIS Controls, ISO/IEC 27001 e SABSA) de forma auditável e segura.

### 2. Arquitetura Multicamadas (Detailed C4 Containers & Components)
A solução adota um design limpo e estruturado em camadas no frontend e backend para garantir separação de preocupações e robustez operacional:

#### A. Camada de Frontend (SPA)
- **UI View Layer (HTML5 / CSS3)**: Utiliza a marca oficial **Telefônica Mistica** (cores roxas `#660099`, laranja Vivo `#FF9900` e tipografia Outfit do Google Fonts) para renderizar o Kanban de segurança, gerenciador de status e formulários de acesso.
- **DOM Controller (JavaScript - app.js)**: Controla o estado em tempo de execução no cliente, gerencia a lógica de drag-and-drop de chamados SecOps e manipula requisições assíncronas assinaladas via Fetch API.

#### B. Camada de Backend (Sinatra Microservice)
- **REST Router & Controllers**: Roteamento leve em Ruby Sinatra. Expõe APIs estruturadas (`/api/tickets`, `/api/statuses`, `/api/iam`). É responsável por injetar cabeçalhos rígidos de segurança HTTP (CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff).
- **ActiveRecord ORM (Modelos & Validações)**: Traduz o esquema do banco de dados em classes e relacionamentos Ruby (`Status`, `Ticket`, `Comment`, `AuditLog`, `IamProvider`, `IamUser`, `IdentityRequest`). Valida regras de negócio corporativas (ex: transição segura ao deletar status, movendo os chamados em transação de banco de dados para evitar inconsistência de registros).
- **IGA Provisioning Engine**: Processador de conectores e conformidades IAM. Executa simulações de sincronização e fluxos formais de governança IGA (Approval Workflows).

#### C. Camada de Banco de Dados (SQLite3)
- Banco de dados relacional encapsulado em arquivo físico local. Implementa chaves estrangeiras rígidas (`FOREIGN KEY`) para integridade referencial.

---

### 3. Integração com Microsserviços IAM / IGA
O CyberITSM possui adaptadores nativos para gerenciar identidades a partir de quatro grandes provedores de mercado:
- **Microsoft Entra ID**: Conector simulado que importa identidades com base em escopos OIDC e grupos corporativos (ex: colaboradores Ana e Bernardo).
- **Keycloak Broker**: Conector OIDC que mapeia Realms e simula credenciais de Client ID/Client Secret em servidores centralizados (ex: colaboradores Kelly e Kevin).
- **Oracle Access Manager (OAM)**: Integração via emulação de injeção de cabeçalhos de rede HTTP baseada em Gateways legados (WebGate Remote User) (ex: colaboradores Oscar e Olivia).
- **Sailpoint IdentityNow (IGA)**: Módulo de governança formal que exige criação de requisição (Identity Request), workflow de aprovação por gestor SecOps e provisionamento local automático pós-autorização (ex: colaboradores Sam e Sarah).
- **Criação Manual (Local)**: Rota direta (`POST /api/iam/users`) que permite o cadastro de colaboradores locais diretamente no banco de dados com perfil RBAC específico.

---

### 4. Suite de Testes & Segurança (SecOps)
- **RSpec e Rack::Test**: Executa 13 testes funcionais que cobrem o Kanban, a integridade da remoção de status, criação manual de usuários de IAM e processos do Sailpoint.
- **SCA**: `bundler-audit` analisa a árvore de dependências do Gemfile em busca de vulnerabilidades CVE ativas.
- **SAST**: `brakeman` e `rubocop` avaliam a qualidade e segurança do código estático contra falhas de injeção e desvios de sintaxe.
- **DAST**: O script `scripts/security_scan.rb` sobe a aplicação localmente e testa injeções de parâmetros e valida a correta resposta dos cabeçalhos HTTP OWASP.

---

### 5. Roteiro de Próximos Passos (Enterprise Roadmap)
Para elevar a aplicação ao nível enterprise em produção, as seguintes etapas devem ser seguidas:
1. **Conteinerização Completa (Docker/Compose)**: Escrever o `Dockerfile` para o serviço Sinatra e orquestrar múltiplos ambientes (Staging/Production) com `docker-compose.yml` integrando o banco de dados.
2. **Migração para PostgreSQL**: Substituir o driver de SQLite3 por PostgreSQL no arquivo `database.yml` para suportar alta concorrência de acessos, pool de conexões robusto e failover automático.
3. **Integração OAuth2/OIDC Real**: Substituir os dados simulados por fluxos reais de redirecionamento OIDC (authorization code flow) utilizando bibliotecas como `omniauth` e mapeando claims de perfil diretamente no Microsoft Entra ID e Keycloak produtivos.
4. **Criptografia e Logs Imutáveis com Assinatura**: Adicionar criptografia de chaves assimétricas para assinar digitalmente cada alteração em `audit_logs` no banco de dados, tornando as trilhas infalsificáveis.
5. **Secret Management (Vault)**: Remover as credenciais e senhas de conectores IAM da base de dados e consumi-las em tempo de execução via cofre de chaves (ex: HashiCorp Vault).

---

## 🇺🇸 English - Technical Specification

### 1. System Overview
**CyberITSM** is an enterprise ticket management platform specialized in **Cybersecurity Architecture and Compliance**. It implements an Atlassian Jira-inspired visual Kanban board workflow, allowing architects and SecOps analysts to correlate every action with international compliance standards (NIST CSF, CIS Controls, ISO/IEC 27001, and SABSA) in an auditable and secure environment.

### 2. Multi-Layer Architecture (Detailed C4 Containers & Components)
The application adopts a clean, layered design in both frontend and backend to guarantee strict separation of concerns and operational durability:

#### A. Frontend Layer (SPA)
- **UI View Layer (HTML5 / CSS3)**: Employs **Telefonica's Mistica** design system tokens (Vivo purple palette `#660099`, orange warning color `#FF9900`, and Google Fonts Outfit typography) to render the security board, settings view, and IAM forms.
- **DOM Controller (JavaScript - app.js)**: Manages in-browser state, handles drag-and-drop operations on SecOps cards, and performs asynchronous Fetch API requests to update views in real-time.

#### B. Backend Layer (Sinatra Microservice)
- **REST Router & Controllers**: Sinatra REST endpoints (`/api/tickets`, `/api/statuses`, `/api/iam`) responsible for mapping payloads and injecting OWASP HTTP protection headers (CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff).
- **ActiveRecord ORM (Models & Validations)**: Maps database schemas to object representations (`Status`, `Ticket`, `Comment`, `AuditLog`, `IamProvider`, `IamUser`, `IdentityRequest`). Applies business constraints such as dynamic column reordering and secure ticket transfer transactions during status deletion.
- **IGA Provisioning Engine**: Processes synchronizations and authorization workflows (simulating target connector updates).

#### C. Database Container (SQLite3)
- Embedded SQL file persisting tables with strict foreign key constraints to enforce database referential integrity.

---

### 3. Identity & Access Governance Integrations (IAM / IGA)
The system exposes modular adapters mimicking four market-leading identity providers:
- **Microsoft Entra ID**: Cloud OIDC client simulating identity imports based on scopes and claims (e.g., users Ana and Bernardo).
- **Keycloak Broker**: OIDC Realm mapping client credentials and local RBAC translations (e.g., users Kelly and Kevin).
- **Oracle Access Manager (OAM)**: WebGate emulation extracting identity properties from gateway HTTP headers (e.g., users Oscar and Olivia).
- **Sailpoint IdentityNow (IGA)**: Triggers access requests, records approval workflows by SecOps managers, and provisions identities locally upon authorization (e.g., users Sam and Sarah).
- **Manual Provisioning**: Exposes a REST API (`POST /api/iam/users`) allowing administrators to manually register and assign RBAC profiles locally.

---

### 4. Automated Security Pipeline (SecOps)
- **RSpec & Rack::Test**: Features 13 functional integration test cases validating Kanban board behavior, safe status cascades, manual user creation, and audit logging.
- **SCA**: `bundler-audit` scans gem dependencies for known security advisories (CVEs).
- **SAST**: `brakeman` and `rubocop` perform static analysis on source code to identify code injection risks and syntactical formatting issues.
- **DAST**: `scripts/security_scan.rb` boots a test Puma server and dynamically verifies HTTP response security headers and SQL Injection parameter sanitization.

---

### 5. Enterprise Roadmap & Next Steps
To transition the application from a simulated sandbox to a production-grade enterprise platform, the following roadmap is proposed:
1. **Docker Containerization**: Author a standard `Dockerfile` and `docker-compose.yml` to package the Sinatra microservice and database assets for multi-environment orchestration.
2. **PostgreSQL Migration**: Switch database driver config in `database.yml` to use PostgreSQL, unlocking connection pooling, horizontal scaling, and high availability.
3. **Production OAuth2/OIDC Flow**: Replace local mock users with standard OIDC redirect flows (authorization code exchange) utilizing gems like `omniauth` to bind live EntraID and Keycloak tokens.
4. **Immutable Log Signatures**: Implement asymmetric cryptography (RSA/ECDSA) to digitally sign every entry in the `audit_logs` table, securing audit trails from tampering.
5. **Key Management (Vault)**: Remove client secrets and system credentials from the database and retrieve them dynamically from an external key vault (such as HashiCorp Vault or Azure Key Vault).
