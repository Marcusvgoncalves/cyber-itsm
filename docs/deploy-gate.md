# 🚦 Deploy Gate — Bloqueio por Vulnerabilidades (CI → Vercel)

Este documento explica como o **pipeline de segurança** (`Enterprise Security Scan`) é acionado a cada commit/deploy e como ele **bloqueia a esteira** antes da publicação na Vercel quando vulnerabilidades são encontradas.

---

## 🇧🇷 Português

### 1. O que o pipeline verifica

Workflow: `.github/workflows/enterprise-security.yml`

| Job | Ferramenta | O que detecta | Bloqueia? |
| :--- | :--- | :--- | :--- |
| `secrets` | **Gitleaks** (+ `.gitleaks.toml`) | Vazamento de segredos no histórico: `sb_publishable_*`/`sb_secret_*` (Supabase), `AQ.*`/`AIza...` (Gemini/Google), URLs reais de projeto Supabase, além das regras padrão | ✅ Sim |
| `sast` | **CodeQL** + **Semgrep** | Fluxo de dados inseguro (XSS, SQLi, SSRF, path traversal), regras OWASP Top 10 e padrões anti-seguros React/Next.js | ✅ Sim |
| `sca` | **Trivy** | CVEs nas dependências (`package-lock.json`) e misconfigurações de IaC, severidades `HIGH,CRITICAL` | ✅ Sim |
| `dast` | **OWASP ZAP Baseline** | Varredura dinâmica do app em execução: headers de segurança ausentes, cookies inseguros, XSS refletido | ✅ Sim |

### 2. Quando o pipeline roda

```yaml
on:
  push:
    branches: [main]        # todo commit na main
  pull_request:
    branches: [main]        # revisão de código
  workflow_dispatch:        # disparo manual (antes de deploy on-demand/release)
```

### 3. Como o bloqueio é garantido

1. **Job com achado falha o pipeline** — cada ferramenta retorna exit-code não-zero em severidades configuradas:
   - Gitleaks: qualquer segredo encontrado → job `FAILED`.
   - Semgrep: achados falham o job (sem `auditOn`, modo *audit* desativado).
   - CodeQL: findings falham o job.
   - Trivy: `exit-code: '1'` + `severity: HIGH,CRITICAL`.
   - ZAP: `fail_action: true`.
2. **Workflow geral = `FAILED`** → o check `Enterprise Security Scan` fica vermelho no GitHub.
3. **Branch protection** (requerido): em `Settings → Branches → main`, marque `Enterprise Security Scan` como **required status check**. Assim o merge e o status de deploy não são liberados enquanto o check não passar.

### 4. Bloqueando o deploy na Vercel

O GitHub sinaliza o status; a Vercel só deve publicar quando o check estiver verde:

1. **GitHub — Branch protection** (Settings → Branches → `main`):
   - Habilitar *Require status checks to pass before merging*.
   - Marcar **`Enterprise Security Scan`** (e, se desejado, os checks individuais `secrets`, `sast`, `sca`, `dast`).
2. **Vercel — Ignored Build Step** (Project Settings → Git):
   - Em *Ignored Build Step*, rode a lógica de só deploiar quando o check do GitHub passou.
   - Exemplo (Vercel executa e ignora o build se o comando retornar 0):
     ```bash
     # Se ainda houver checks pendentes, não faz deploy (retorna 0 = "ignorar").
     # Ajuste conforme o nome exato do seu check no GitHub.
     if gh api repos/$VERCEL_GIT_REPO_OWNER/$VERCEL_GIT_REPO_SLUG/commits/$VERCEL_GIT_COMMIT_SHA/check-runs \
        --jq '.check_runs[] | select(.name=="Enterprise Security Scan") | .status' | grep -q completed; then
       exit 1   # check finalizado: a Vercel prossegue com o build/deploy
     else
       exit 0   # ainda pendente: a Vercel ignora (aguarda)
     fi
     ```
3. (Opcional) **Vercel Deployment Protection** — restrinja produção ao branch `main` e, se aplicável, a um ambiente de produção que exija o check.

> ⚠️ **Resultado**: com isso, **nenhum commit com vulnerabilidade** (segredo exposto, CVE High/Critical, falha de código OWASP ou achado dinâmico) chega ao deploy na Vercel — a esteira é bloqueada na origem.

### 5. Regras customizadas de segredos (`.gitleaks.toml`)

O arquivo `.gitleaks.toml` estende a base padrão do Gitleaks com:

- `supabase-publishable-key` → `sb_publishable_[A-Za-z0-9_\-]{20,}`
- `supabase-service-role-key` → `sb_secret_[A-Za-z0-9_\-]{20,}` (crítico)
- `supabase-jwt-service-role` → JWT com claim `service_role`
- `google-gemini-api-key` → `AQ[A-Za-z0-9_\-]{35,}`
- `google-api-key-legacy` → `AIza[0-9A-Za-z_\-]{35}`
- `supabase-project-url` → URL real `https://xxxx.supabase.co`

**Allowlists** excluem `.env.example`, `README.md`, `docs/`, `node_modules/`, `package-lock.json` e placeholders de documentação — para não gerar falsos positivos com exemplos.

### 6. Testar localmente antes do push

```bash
# Instala o gitleaks (uma vez)
go install github.com/gitleaks/gitleaks/v8/cmd/gitleaks@latest   # ou via brew/docker

# Varre o working tree
gitleaks detect --config .gitleaks.toml --source .

# Varre todo o histórico de commits
gitleaks detect --config .gitleaks.toml --source . --log-opts="--all"
```

---

## 🇺🇸 English

### 1. What the pipeline checks

Workflow: `.github/workflows/enterprise-security.yml`

| Job | Tool | Detects | Blocks? |
| :--- | :--- | :--- | :--- |
| `secrets` | **Gitleaks** (+ `.gitleaks.toml`) | Secret leakage in history: `sb_publishable_*`/`sb_secret_*` (Supabase), `AQ.*`/`AIza...` (Gemini/Google), real Supabase project URLs, plus the default rule set | ✅ Yes |
| `sast` | **CodeQL** + **Semgrep** | Insecure data flow (XSS, SQLi, SSRF, path traversal), OWASP Top 10 rules and anti-secure React/Next.js patterns | ✅ Yes |
| `sca` | **Trivy** | CVEs in dependencies (`package-lock.json`) and IaC misconfigurations at `HIGH,CRITICAL` severity | ✅ Yes |
| `dast` | **OWASP ZAP Baseline** | Dynamic scan of the running app: missing security headers, insecure cookies, reflected XSS | ✅ Yes |

### 2. When the pipeline runs

```yaml
on:
  push:
    branches: [main]        # every commit on main
  pull_request:
    branches: [main]        # code review
  workflow_dispatch:        # manual trigger (before on-demand/release deploy)
```

### 3. How blocking is guaranteed

1. **A job with findings fails the pipeline** — each tool returns a non-zero exit code on configured severities:
   - Gitleaks: any secret found → job `FAILED`.
   - Semgrep: findings fail the job (no `auditOn`, audit mode off).
   - CodeQL: findings fail the job.
   - Trivy: `exit-code: '1'` + `severity: HIGH,CRITICAL`.
   - ZAP: `fail_action: true`.
2. **Overall workflow = `FAILED`** → the `Enterprise Security Scan` check turns red on GitHub.
3. **Branch protection (required)**: under `Settings → Branches → main`, mark `Enterprise Security Scan` as a **required status check**. Merges and deploy status are not released until the check passes.

### 4. Blocking the Vercel deploy

GitHub reports the status; Vercel should only publish when the check is green:

1. **GitHub — Branch protection** (Settings → Branches → `main`):
   - Enable *Require status checks to pass before merging*.
   - Mark **`Enterprise Security Scan`** (and, if desired, the individual checks `secrets`, `sast`, `sca`, `dast`).
2. **Vercel — Ignored Build Step** (Project Settings → Git):
   - Under *Ignored Build Step*, only deploy when the GitHub check passed.
   - Example (Vercel skips the build if the command returns 0):
     ```bash
     # If checks are still pending, skip the deploy (return 0 = "ignore").
     # Adjust to the exact check name in your GitHub repo.
     if gh api repos/$VERCEL_GIT_REPO_OWNER/$VERCEL_GIT_REPO_SLUG/commits/$VERCEL_GIT_COMMIT_SHA/check-runs \
        --jq '.check_runs[] | select(.name=="Enterprise Security Scan") | .status' | grep -q completed; then
       exit 1   # check finished: Vercel proceeds with build/deploy
     else
       exit 0   # still pending: Vercel ignores (waits)
     fi
     ```
3. (Optional) **Vercel Deployment Protection** — restrict production to the `main` branch and, if applicable, a production environment that requires the check.

> ⚠️ **Result**: with this setup, **no commit containing a vulnerability** (exposed secret, High/Critical CVE, OWASP code flaw, or dynamic finding) reaches the Vercel deploy — the pipeline is blocked at the source.

### 5. Custom secret rules (`.gitleaks.toml`)

The `.gitleaks.toml` file extends Gitleaks' default base with:

- `supabase-publishable-key` → `sb_publishable_[A-Za-z0-9_\-]{20,}`
- `supabase-service-role-key` → `sb_secret_[A-Za-z0-9_\-]{20,}` (critical)
- `supabase-jwt-service-role` → JWT with `service_role` claim
- `google-gemini-api-key` → `AQ[A-Za-z0-9_\-]{35,}`
- `google-api-key-legacy` → `AIza[0-9A-Za-z_\-]{35}`
- `supabase-project-url` → real URL `https://xxxx.supabase.co`

**Allowlists** exclude `.env.example`, `README.md`, `docs/`, `node_modules/`, `package-lock.json`, and documentation placeholders — avoiding false positives from examples.

### 6. Test locally before pushing

```bash
# Install gitleaks (once)
go install github.com/gitleaks/gitleaks/v8/cmd/gitleaks@latest   # or via brew/docker

# Scan the working tree
gitleaks detect --config .gitleaks.toml --source .

# Scan the full commit history
gitleaks detect --config .gitleaks.toml --source . --log-opts="--all"
```

---

## 🇧🇷 Resolução de Incidentes / 🇺🇸 Vulnerability Mitigation

### [2026-08-05] Remoção do Pacote `xlsx` (High Severity CVE-2024)
- **Vulnerabilidade**: O pacote `xlsx` (SheetJS) apresentava vulnerabilidades críticas e altas de poluição de protótipo (Prototype Pollution - GHSA-4r6h-8v6p-xvw6) e negação de serviço por expressões regulares (ReDoS - GHSA-5pgg-2g8v-p4x9), bloqueando a esteira SCA (Trivy/npm audit).
- **Ação**: Como o arquivo `BaseRequisitosSD_v4.1.xlsx` e o script de carga `parse_excel.js` foram excluídos da plataforma em favor da base estática imutável JSON, a dependência `xlsx` tornou-se obsoleta.
- **Resultado**: O pacote foi totalmente removido (`npm uninstall xlsx`), reduzindo a zero o número de vulnerabilidades de dependências no pipeline SecOps.

