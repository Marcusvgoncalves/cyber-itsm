/**
 * Feature Flags do CyberITSM.
 *
 * Regra de ouro: TODA funcionalidade nova nasce DESLIGADA por padrão
 * (build-time default `false`) e só é exposta quando o Kill Switch for
 * explicitamente ligado. Isso garante rollback instantâneo.
 *
 * IMPORTANTE — leitura em RUNTIME (não embutida no build):
 * usa o `process.env` global (e não `node:process`) porque este módulo é
 * importado pelo `proxy.ts` (Edge Runtime) e por rotas Node — o import do
 * builtin `node:process` não é permitido no Edge. A leitura via CHAVE
 * DINÂMICA (constante) garante que a variável NÃO seja inlined no bundle
 * em build-time, sendo avaliada a cada request (documentação Next.js:
 * dynamic lookups não são inlined). Variáveis NEXT_PUBLIC_* referenciadas
 * como literal (`process.env.NEXT_PUBLIC_X`) seriam embutidas no build.
 */

const EMBEDDABLE_ENGINE_ENV = 'NEXT_PUBLIC_ENABLE_EMBEDDABLE_ENGINE';

/**
 * Kill Switch do Motor Embarcável (API-First + UI Embeddable).
 * Nascido DESLIGADO por padrão (fail-closed): retorna `false` sempre que a
 * variável não existir ou não for exatamente `"true"`.
 *
 * Leitura dinâmica via chave-variável: o valor é resolvido em RUNTIME, então
 * alterar `NEXT_PUBLIC_ENABLE_EMBEDDABLE_ENGINE` nas variáveis de ambiente da
 * Vercel bloqueia o acesso imediatamente (após o ciclo de deploy, ver
 * ROLLBACK_EMBEDDABLE.md para o fluxo completo).
 */
export function isEmbeddableEngineEnabled(): boolean {
  const value = process.env[EMBEDDABLE_ENGINE_ENV];
  return value === 'true';
}

/** Origem permitida para embutir o motor via iframe (frame-ancestors). */
export const EMBED_ALLOWED_FRAME_ORIGIN = 'https://*.dominiocliente.com';
