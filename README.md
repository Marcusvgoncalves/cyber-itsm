# CyberITSM SPN 🛡️

**CyberITSM SPN** é uma plataforma corporativa de IT Service Management (ITSM) especializada em **Arquitetura de Cibersegurança e Conformidade Regulatória**. O projeto foi reconstruído utilizando a linguagem **Ruby (Sinatra)**, oferecendo um quadro Kanban interativo estilo Jira para controle de atividades de mitigação de vulnerabilidades, seguindo a paleta de cores e tipografia clara do design system **Mistica da Vivo Telefônica**.

*English:* **CyberITSM SPN** is an enterprise IT Service Management (ITSM) ticketing and Kanban platform specialized in **Cybersecurity Architecture and Regulatory Compliance**. Fully rebuilt in **Ruby (Sinatra)**, it offers a Jira-inspired agile Kanban board styled with the clean, light theme of **Telefonica's Mistica** design system.

---

## 📐 Desenho de Arquitetura C4 (Nível 2 e Nível 3)

Abaixo está o mapeamento visual detalhado dos limites do sistema, contêineres internos e conexões com microsserviços e provedores externos (IAM / IGA):

![CyberITSM SPN C4 Diagram](public/images/architecture.svg)

### 🚀 Tecnologias Adotadas

| Camada / Componente | Tecnologia | Ícone / Descrição |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5 / CSS3 (Mistica Light Theme) | 🎨 Cores claras, tipografia Outfit e responsividade premium. |
| **Frontend Logic** | JavaScript (ES6+ / Fetch API) | ⚡ Gerenciamento de estado local e drag-and-drop dinâmico de cards. |
| **Backend API** | Ruby 3.3.x / Sinatra | 💎 Microserviço leve com roteamento REST, session tokens e CSP. |
| **ActiveRecord ORM** | SQLite3 Driver | 🗄️ Relacionamentos e transações de banco de dados para segurança de dados. |
| **Autenticação & MFA** | BCrypt & ROTP | 🔑 Criptografia salt-hash para senhas e suporte a OTP RFC 6238. |
| **Testes Automatizados** | RSpec & Rack::Test | 🧪 Suite de 17 testes de integração de rotas e lógica. |
| **Varredura de Segurança** | Brakeman, Audit, DAST | 🛡️ SAST, SCA e Pentest dinâmico ativo integrados. |

---

## 🔒 Jornada de Segurança & Políticas Aplicadas

### 1. Complexidade de Senhas Obrigatória
Todas as credenciais locais do sistema devem cumprir a política estrita de complexidade de senhas (12+ caracteres contendo maiúsculas, minúsculas, dígitos numéricos e símbolos especiais). Exemplo de senha seeded padrão:
`CyberITSM@2026!Password`

### 2. Fluxo de Autenticação com Sessão
- Autenticação armazenada na sessão segura do servidor via cookie assinado do Sinatra.
- Proteção automática com filtro `before '/api/*'` retornando `401 Unauthorized` se o cookie estiver ausente.

### 3. Configuração de MFA Obrigatória no Primeiro Acesso
- O MFA é exigido para todos os usuários cadastrados.
- No primeiro login, caso o usuário não possua o MFA configurado (`mfa_setup_complete == false`), o sistema o redireciona automaticamente para um painel de Onboarding na tela de login (`login.html`), exibindo o QR Code gerado via URI TOTP para sincronização em dispositivos móveis (ex: Google Authenticator). A sessão só é liberada após a primeira validação do código de 6 dígitos.

### 4. Controle de Acesso Baseado em Função (RBAC) para C4
- Apenas usuários com a função **Admin** podem visualizar o Desenho de Arquitetura C4 interativo no menu lateral ou acessar a página `/architecture.html` (com redirecionamento automático para a raiz `/` no backend caso outro perfil tente acessar).

---

## ⚙️ Execução Local / Running Locally

1. **Dependências**: Garanta que possui o Ruby 3.3+ com DevKit instalado.
2. **Instalação das Gems**:
   ```powershell
   bundle install
   ```
3. **Migrações e Seeds**: Execute as migrações nos ambientes de desenvolvimento e teste:
   ```powershell
   bundle exec rake db:migrate
   $env:RACK_ENV="test"; bundle exec rake db:migrate
   ```
4. **Inicie o Servidor**:
   ```powershell
   bundle exec ruby app.rb
   ```
5. **Acesso**: Abra `http://localhost:4567` no navegador (você será direcionado ao `/login.html`).
   *Credenciais de teste padrão:* `joao.secops@telefonica.com` / `CyberITSM@2026!Password`

---

## 🧪 Rodando Testes / Running Tests

Para validar as APIs, regras de negócio e logs de auditoria:
```powershell
bundle exec rspec
```

---

## 🛡️ Pipeline de Segurança / Security Pipeline (SAST, DAST, SCA)

O CyberITSM SPN possui uma pipeline automatizada de validações de segurança em conformidade com as diretrizes SecOps:
```powershell
ruby scripts/security_scan.rb
```
Este script executa:
1. **SCA**: Inspeciona falhas conhecidas de dependências no `Gemfile.lock` (`bundle-audit`).
2. **SAST**: Análise estática contra vulnerabilidades de código (`brakeman`) e linter de qualidade (`rubocop`).
3. **DAST**: Levanta o servidor Puma em porta de testes e simula payloads maliciosos, validando a sanitização contra SQL Injection e verificando a presença de cabeçalhos de segurança HTTP rígidos (`X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`).

---

## ☁️ Publicação e Arquitetura de Deploy (Vercel + Render)

O projeto adota uma arquitetura de implantação híbrida para garantir alto desempenho e persistência de dados:

1. **Frontend (Vercel)**: Os arquivos estáticos contidos na pasta `public/` (Mistica UI) são hospedados e distribuídos globalmente via CDN da Vercel.
2. **Backend (Render)**: O microserviço Ruby Sinatra roda no contêiner Linux da Render e se conecta ao SQLite3 persistido sob um volume montado no diretório `db/data/`.
3. **Proxy Reverso (`vercel.json`)**: A Vercel atua como proxy reverso, reescrevendo requisições de `/api/*` diretamente para a URL da Render. Isso resolve restrições de CORS no navegador e permite o tráfego automático de cookies de sessão de mesma origem.

### Passos para Deploy:
- **Deploy do Frontend (Vercel)**:
  ```powershell
  vercel --prod
  ```
- **Deploy do Backend (Render)**: Conecte o repositório GitHub ao painel da Render e crie um **Web Service** com o arquivo `render.yaml`. As migrações de banco de dados serão aplicadas automaticamente no deploy antes da inicialização.
