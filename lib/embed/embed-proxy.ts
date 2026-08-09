import { NextResponse, type NextRequest } from 'next/server';
import { EMBED_ALLOWED_FRAME_ORIGIN, isEmbeddableEngineEnabled } from '@/utils/featureFlags';

/**
 * Proxy isolado para o Motor Embarcável (Additive Development).
 *
 * Next.js 16 renomeou `middleware.ts` para `proxy.ts` (o arquivo `middleware`
 * está deprecated nesta versão) e permite apenas UM arquivo proxy por projeto.
 * Seguindo a recomendação oficial, esta lógica vive em um módulo separado e é
 * importada pelo `proxy.ts` raiz — efeito equivalente a um `middleware.ts`
 * com matcher exclusivo para `/embed/:path*`.
 *
 * Escopo TERMINANTEMENTE limitado a `/embed/*`:
 *  - retorna 404 (Kill Switch OFF) sem tocar no restante da aplicação;
 *  - injeta CSP frame-ancestors + X-Frame-Options APENAS nesta rota;
 *  - o restante da aplicação NÃO passa por esta interceptação de frame.
 */
const EMBED_PREFIX = '/embed';

/**
 * @returns NextResponse quando a requisição é `/embed/*` (headers ou 404),
 *          ou `null` para deixar o proxy principal seguir o fluxo normal.
 */
export function handleEmbedRequest(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith(EMBED_PREFIX)) {
    return null;
  }

  // Kill Switch: a estrutura nasce desligada. Qualquer request para /embed/*
  // com a flag OFF recebe 404 imediato.
  if (!isEmbeddableEngineEnabled()) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // Isolamento de headers de frame SOMENTE para /embed/*.
  // Sobrescreve o X-Frame-Options: SAMEORIGIN e o frame-ancestors 'self'
  // globais apenas nesta resposta (o proxy executa DEPOIS dos headers
  // estáticos do next.config.ts, que permanecem intocados).
  const response = NextResponse.next();
  response.headers.set(
    'Content-Security-Policy',
    `frame-ancestors 'self' ${EMBED_ALLOWED_FRAME_ORIGIN};`
  );
  response.headers.set('X-Frame-Options', `ALLOW-FROM ${EMBED_ALLOWED_FRAME_ORIGIN}`);
  return response;
}
