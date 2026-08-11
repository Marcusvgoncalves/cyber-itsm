import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth/types';

/**
 * ============================================================================
 * MCP LOCAL — Tipos compartilhados do barramento de ferramentas.
 *
 * Módulo 100% ADITIVO e ISOLADO. Nenhuma rota, layout ou funcionalidade
 * existente é alterada por este arquivo. Ele apenas define os contratos de
 * dados usados por `lib/mcp/server.ts`, `lib/mcp/tools.ts` e
 * `lib/mcp/adapter.ts`.
 *
 * Design: as ferramentas executam NO MESMO PROCESSO do servidor Next.js
 * (Custo Zero), com o SDK oficial `@modelcontextprotocol/sdk` instanciando um
 * MCP Server local que também pode ser exposto via transporte stdio para
 * clientes MCP externos (ex.: Claude Desktop) sem qualquer custo adicional.
 * ============================================================================
 */

/** Bloco de conteúdo de texto no formato do protocolo MCP. */
export interface McpTextContent {
  type: 'text';
  text: string;
}

/**
 * Resultado padronizado de uma execução de ferramenta MCP local.
 * Espelha o `CallToolResult` do protocolo (content + structuredContent +
 * isError) para permitir saída estruturada de forma nativa.
 */
export interface McpToolResult {
  content: McpTextContent[];
  /** Saída estruturada (opcional) — consumida diretamente pelo Copiloto. */
  structuredContent?: Record<string, unknown>;
  /** `true` sinaliza falha controlada (o modelo explica ao usuário). */
  isError?: boolean;
}

/**
 * Contexto de execução injetado pelo Copiloto.
 *
 * O contexto de autenticação é resolvido EAGERLY na rota de chat (antes do
 * streaming iniciar) e propagado às ferramentas via `toolsContext` do Vercel
 * AI SDK. Isso garante que NENHUMA ferramenta dependa de cookies lidos
 * tardiamente durante o streaming — isolando o MCP de regressões de sessão.
 */
export interface McpExecutionContext {
  auth: AuthContext | null;
  /**
   * Header `Cookie` do request original. Reencaminhado nos fetches internos
   * `/api/v1` (Feature Flag `USE_MICROSERVICES_API`) para preservar a MESMA
   * sessão autenticada sem criar uma superfície nova de autenticação.
   */
  cookies?: string;
  /** Origin do request original — base absoluta para os fetches internos. */
  origin?: string;
}

/**
 * Contrato interno de uma ferramenta registrada no MCP local.
 *
 * `inputSchema` é um schema Zod (fonte da verdade da higienização de dados).
 * `execute` recebe os argumentos JÁ validados por Zod e o contexto de
 * execução, e devolve um `McpToolResult`.
 */
export interface McpToolDefinition<
  ArgsSchema extends z.ZodTypeAny = z.ZodTypeAny,
> {
  name: string;
  title?: string;
  description: string;
  inputSchema: ArgsSchema;
  execute: (
    args: z.infer<ArgsSchema>,
    ctx: McpExecutionContext,
  ) => Promise<McpToolResult>;
}

/** Conveniência tipada para auxiliares de resposta do MCP. */
export type { AuthContext };
