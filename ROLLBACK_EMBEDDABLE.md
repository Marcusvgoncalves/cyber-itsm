# ROLLBACK — Motor Embarcável (Kill Switch e Plano de Contingência)

> **Objetivo**: remover/desligar o Motor Embarcável (APIs `/api/external/*` e UI `/embed/*`)
> com **risco zero** para o ambiente de produção atual.

---

## Passo 1 — Kill Switch imediato

1. Acesse o painel da Vercel → **Project → Settings → Environment Variables**.
2. Defina:

   ```env
   NEXT_PUBLIC_ENABLE_EMBEDDABLE_ENGINE=false
   ```

3. **Fail-closed**: o código (`utils/featureFlags.ts`) só devolve `true` se a variável
   for exatamente `"true"`. Se a variável não existir ou for qualquer outro valor,
   o motor permanece DESLIGADO — mesmo que a configuração seja perdida por engano.

4. O `proxy.ts` devolve **404** para qualquer `/embed/*`; as rotas `/api/external/v1/*`
   devolvem **404**; a página `/embed/security-qa/[id]` executa `notFound()`.

> **Nota (Next.js)**: variáveis `NEXT_PUBLIC_*` referenciadas como literal são embutidas
> no bundle em build-time. Este código lê a variável via **chave dinâmica**
> (`process.env[CONST]`), que NÃO é inlined — o valor é avaliado em runtime.
> Para efeito garantido e instantâneo, execute também o Passo 2 (reversão via git)
> ou reimplante o build com a variável `false`.

## Passo 2 — Reversão do código-fonte (git)

Caso seja necessário remover os commits que introduziram o Motor Embarcável:

```bash
# 1. Identifique o hash do commit que adicionou a funcionalidade:
git log --oneline --grep="embed"

# 2. Reverta APENAS esse commit (mantém o histórico e desfaz as mudanças):
git revert <hash-do-commit>

# Exemplo:
# git revert a1b2c3d

# 3. Caso o commit esteja no topo da branch e existam commits posteriores,
#    use o intervalo até o mais recente:
# git revert <hash-inicial>^..HEAD

# 4. Envie a reversão:
git push origin main
```

### Arquivos criados por esta feature (referência para reversão manual)

| Arquivo | Ação se reverter manualmente |
| --- | --- |
| `utils/featureFlags.ts` | remover |
| `lib/embed/embed-proxy.ts` | remover |
| `lib/embed/api-auth.ts` | remover |
| `lib/llm/agent-router.ts` | remover |
| `app/api/external/v1/security-qa/route.ts` | remover |
| `app/api/external/v1/llm-proxy/route.ts` | remover |
| `app/embed/security-qa/[id]/page.tsx` | remover |
| `components/embed/security-qa-widget.tsx` | remover |
| `proxy.ts` (bloco `handleEmbedRequest`) | reverter edição |
| `.env` / `.env.example` (1 variável) | reverter edição |

---

## Critérios de Sucesso do Rollback

- [ ] `/embed/*` retorna 404 com `NEXT_PUBLIC_ENABLE_EMBEDDABLE_ENGINE=false`;
- [ ] `/api/external/v1/*` retorna 404 com a flag OFF;
- [ ] Nenhum header global de CSP/Frame foi alterado (`next.config.ts` intocado);
- [ ] O restante da aplicação segue com `X-Frame-Options: SAMEORIGIN` e `frame-ancestors 'self'`.
