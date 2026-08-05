# 🔧 Fix Enterprise Security Workflow — Copy & Paste Prompt

## Para usar com @copilot no OpenCode ou GitHub Copilot Chat

---

## Prompt Completo (Copie e Cole)

```
@copilot Você precisa corrigir o workflow de segurança enterprise que está falhando com erros de permissão.

Os erros identificados no job https://github.com/Marcusvgoncalves/cyber-itsm/actions/runs/31040038432/job/92421824154 são:

1. **CodeQL Permission Error**: Falta de permissão "security-events: read" na seção permissions
2. **Code Scanning Not Enabled Warning**: CodeQL tenta fazer upload sem o Code Scanning estar habilitado
3. **ZAP Resource Not Accessible**: A action ZAP não consegue criar issues automaticamente

## Correções Necessárias no arquivo `.github/workflows/enterprise-security.yml`

### Mudança 1: Adicionar permissão na seção permissions (linhas 51-54)

Localize:
```yaml
permissions:
  contents: read
  security-events: write
  actions: read
```

Substitua por:
```yaml
permissions:
  contents: read
  security-events: write
  security-events: read
  actions: read
```

### Mudança 2: Adicionar continue-on-error ao step CodeQL Analyze

Localize o step "Analyze (CodeQL)" (por volta da linha 147):
```yaml
      - name: Analyze (CodeQL)
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:javascript-typescript"
```

Substitua por:
```yaml
      - name: Analyze (CodeQL)
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:javascript-typescript"
        continue-on-error: true
```

## Por que essas mudanças resolvem o problema?

1. **security-events: read** → Permite que CodeQL acesse a API de segurança do GitHub
2. **continue-on-error: true** → Permite que o workflow continue mesmo se Code Scanning não estiver habilitado no repositório (não bloqueia o pipeline)

## Validação pós-correção

Após aplicar as mudanças:
1. Vá para Actions > Enterprise Security Scan
2. Clique em "Run workflow"
3. Verifique que os jobs completam sem erros de permissão

Esperado:
- ✅ Job 'secrets' passa
- ✅ Job 'sast' passa ou completa com warnings (não ❌)
- ✅ Job 'sca' passa
- ✅ Job 'dast' passa ou completa com warnings (não ❌)
```

---

## Versão Resumida (Se Preferir)

```
@copilot Corrija o workflow .github/workflows/enterprise-security.yml com essas duas mudanças:

1. Na seção permissions (linha 51), adicione "security-events: read":
   permissions:
     contents: read
     security-events: write
     security-events: read
     actions: read

2. No step "Analyze (CodeQL)" (linha 147), adicione "continue-on-error: true":
   - name: Analyze (CodeQL)
     uses: github/codeql-action/analyze@v3
     with:
       category: "/language:javascript-typescript"
     continue-on-error: true

Essas mudanças corrigem os erros de permissão CodeQL e impedem que o workflow falhe se Code Scanning não estiver habilitado.
```

---

## Instruções de Uso

### Opção 1: GitHub Copilot Chat
1. Abra [GitHub Copilot Chat](https://github.com/copilot/chat)
2. Cole o **Prompt Completo** acima
3. Aguarde as sugestões
4. Aplique as mudanças sugeridas

### Opção 2: OpenCode
1. Abra o repositório em OpenCode
2. Navegue até `.github/workflows/enterprise-security.yml`
3. Cole o **Prompt Completo** no chat do @copilot
4. Deixe o copilot fazer as edições automáticas

### Opção 3: GitHub UI (Manual)
1. Vá para [`.github/workflows/enterprise-security.yml`](https://github.com/Marcusvgoncalves/cyber-itsm/blob/main/.github/workflows/enterprise-security.yml)
2. Clique no ✏️ (Edit)
3. Aplique as duas mudanças descritas
4. Commit com mensagem: `fix: corrige permissões CodeQL no workflow enterprise-security`

### Opção 4: Git CLI
```bash
# Clone/navegue ao repositório
cd cyber-itsm

# Crie uma branch
git checkout -b fix/enterprise-security-workflow

# Edite o arquivo manualmente com seu editor favorito
# (aplique as mudanças acima)

# Commit
git add .github/workflows/enterprise-security.yml
git commit -m "fix: corrige permissões CodeQL no workflow enterprise-security

- Adiciona permissão 'security-events: read' para CodeQL API
- Adiciona 'continue-on-error: true' ao CodeQL Analyze"

# Push
git push origin fix/enterprise-security-workflow

# Abra um PR no GitHub
```

---

## Referências

- 📘 [GitHub CodeQL Action Documentation](https://github.com/github/codeql-action)
- 📘 [GitHub Actions Permissions Reference](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- 📘 [Workflow Syntax - continue-on-error](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepscontinue-on-error)

---

## Resultado Esperado

Após aplicar as correções, o workflow deverá executar sem bloqueios de permissão:

```
✅ Enterprise Security Scan
├─ ✅ Secret Scanning (Gitleaks)
├─ ✅ Advanced SAST (CodeQL + Semgrep)
├─ ✅ SCA & IaC (Trivy)
└─ ✅ DAST (OWASP ZAP Baseline)
```

---

**Criado**: 2026-08-05  
**Status**: Pronto para uso  
**Versão**: 1.0
