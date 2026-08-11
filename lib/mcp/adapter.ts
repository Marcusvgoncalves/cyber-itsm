import { jsonSchema, tool, type ToolSet } from 'ai';
import { getLocalMcpServer } from './server';
import type { McpToolResult } from './types';
import type { AuthContext } from '@/lib/auth/types';

/**
 * ============================================================================
 * MCP LOCAL — Adaptador para a Esteira de IA (Vercel AI SDK).
 *
 * Ponte entre o servidor MCP local e a propriedade `tools` do
 * `streamText`/`generateText`. Etapas:
 *
 *   1. `server.listTools()` devolve as definições MCP reais (name, description
 *      e `inputSchema` em JSON Schema — derivadas dos schemas Zod);
 *   2. Cada definição é convertida em uma `tool()` do AI SDK usando
 *      `jsonSchema(...)` (sem duplicar schemas e sem conversões manuais);
 *   3. O `execute` aciona o MCP Server local (`callTool`), que REVALIDA os
 *      argumentos com Zod e executa a implementação de domínio.
 *
 * A autenticação é resolvida EAGERLY na rota e INJETADA via closure, de modo
 * que as ferramentas SÓ disparam quando há intenção explícita do modelo no
 * chat. Se o modelo não chamar nenhuma tool, o fluxo de texto normal permanece
 * 100% intacto (sem custo e sem efeito colateral).
 * ============================================================================
 */

/** Extrai o texto de um `CallToolResult` MCP. */
function textContent(result: McpToolResult): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

/**
 * Converte o resultado MCP para o formato consumido pelo AI SDK.
 * - `isError` -> lança (vira `tool-error` no stream; o modelo explica o motivo);
 * - `structuredContent` -> devolvido tipado ao modelo;
 * - caso contrário -> texto simples.
 */
function toToolOutput(result: McpToolResult): unknown {
  if (result.isError) {
    throw new Error(textContent(result) || 'Falha na execução da ferramenta MCP.');
  }
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }
  return textContent(result);
}

/**
 * Contexto HTTP do request original, repassado às ferramentas para que a
 * Feature Flag `USE_MICROSERVICES_API` possa reencaminhar a sessão e a base
 * absoluta nos fetches internos para `/api/v1`.
 */
export interface CopilotHttpContext {
  cookies?: string;
  origin?: string;
}

/**
 * Constrói o `ToolSet` do Copiloto a partir das ferramentas do MCP local.
 * O contexto de autenticação (AuthContext) é capturado por closure — cada
 * requisição recebe as suas próprias ferramentas com o seu próprio usuário.
 */
export function createCopilotTools(
  auth: AuthContext | null,
  http?: CopilotHttpContext,
): ToolSet {
  const server = getLocalMcpServer();
  const definitions = server.listTools();
  const tools: ToolSet = {};

  for (const def of definitions) {
    tools[def.name] = tool({
      description: def.description ?? '',
      // Converte o JSON Schema MCP diretamente no inputSchema do AI SDK.
      inputSchema: jsonSchema(def.inputSchema as never),
      execute: async (input: Record<string, unknown>) => {
        const result = await server.callTool(def.name, input, {
          auth,
          cookies: http?.cookies,
          origin: http?.origin,
        });
        return toToolOutput(result);
      },
    });
  }

  return tools;
}

/** Nomes das ferramentas MCP disponíveis (para telemetria/guia de prompt). */
export function copilotToolNames(): string[] {
  return getLocalMcpServer().listTools().map((def) => def.name);
}
