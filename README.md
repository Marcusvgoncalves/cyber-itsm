# CyberITSM 🛡️

**CyberITSM** is an IT Service Management (ITSM) system specialized in **Cybersecurity Architecture**. The project has been fully rebuilt using the **Ruby** language, offering a Jira-inspired agile Kanban board layout with status management, styled following **Telefonica Vivo's Mistica** design system.

*Português:* O **CyberITSM** é um sistema de Gerenciamento de Serviços de TI (ITSM) especializado em **Arquitetura de Cibersegurança**. Reconstruído inteiramente em **Ruby**, oferece um Kanban interativo estilo Jira para gestão de status de atividades, com a identidade visual **Mistica da Vivo Telefônica**.

---

## 🚀 Tecnologias Utilizadas / Tech Stack

- **Linguagem / Language**: [Ruby 3.3.x](https://www.ruby-lang.org/)
- **Micro-framework**: [Sinatra](http://sinatrarb.com/) + [Puma Server](https://puma.io/)
- **Banco de Dados / Database**: SQLite3 managed by [ActiveRecord ORM](https://guides.rubyonrails.org/active_record_basics.html)
- **Aesthetics & UI**: Custom HTML5/Vanilla JS styled using **Telefonica's Mistica** token styles (Vivo branding)
- **Testes / Testing**: [RSpec](https://rspec.info/) + [Rack::Test](https://github.com/rack/rack-test)
- **Segurança / Security**: [Brakeman](https://brakemanscanner.org/) (SAST), [Bundler-Audit](https://github.com/rubysec/bundler-audit) (SCA), custom DAST (dynamic scanner)

---

## ⚙️ Execução Local / Running Locally

1. Certifique-se de possuir o Ruby 3.3+ com DevKit instalado.
2. Instale as dependências:
   ```powershell
   bundle install
   ```
3. Execute as migrações do banco de dados (Development e Test):
   ```powershell
   bundle exec rake db:migrate
   $env:RACK_ENV="test"; bundle exec rake db:migrate
   ```
4. Inicie o servidor de desenvolvimento:
   ```powershell
   bundle exec ruby app.rb
   ```
5. Acesse no seu navegador: `http://localhost:4567`

---

## 🧪 Rodando Testes / Running Tests

Para validar as APIs, regras de negócio e logs de auditoria:
```powershell
bundle exec rspec
```

---

## 🛡️ Pipeline de Segurança / Security Pipeline (SAST, DAST, SCA)

O CyberITSM possui uma pipeline automatizada de validações de segurança em conformidade com as diretrizes SecOps:
```powershell
ruby scripts/security_scan.rb
```
Este script executa:
1. **SCA**: Inspeciona falhas conhecidas de dependências no `Gemfile.lock` (`bundle-audit`).
2. **SAST**: Análise estática contra vulnerabilidades de código (`brakeman`) e linter de qualidade (`rubocop`).
3. **DAST**: Levanta o servidor Puma em porta de testes e simula payloads maliciosos, validando a sanitização contra SQL Injection e verificando a presença de cabeçalhos de segurança HTTP rígidos (`X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`).

---

## 📐 Arquitetura C4 Interativa / C4 Diagram

O desenho de arquitetura C4 interativo está integrado na aplicação e pode ser acessado em:
- Menu lateral da aplicação: **Arquitetura C4**
- Acesso direto: `http://localhost:4567/architecture.html`
- Permite clicar em cada contêiner e visualizar detalhadamente suas tecnologias e responsabilidades operacionais.
