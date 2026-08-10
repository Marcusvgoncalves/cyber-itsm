import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult, Tool as McpTool } from '@modelcontextprotocol/sdk/types.js';
import { mcpToolsRegistry } from './tools';
import type { McpExecutionContext, McpToolDefinition, McpToolResult } from './types';

/**
 * ============================================================================
 * MCP LOCAL — Servidor MCP isolado (in-process).
 *
 * Instancia um MCP Server com o SDK oficial `@modelcontextprotocol/sdk` e
 * registra as ferramentas do ITSM conectadas a Prisma/Supabase.
 *
 * Dois modos de uso:
 *   - IN-PROCESS (padrão do Copiloto): o adaptador (`adapter.ts`) consulta as
 *     definições via `listTools()` e executa via `callTool()` no MESMO
 *     processo — sem transporte, sem rede, CUSTO ZERO.
 *   - STDIO (opcional): `startStdio()` expõe o servidor a clientes MCP
 *     externos (ex.: Claude Desktop) via stdio, mantendo a MESMA lógica.
 *
 * Módulo 100% ADITIVO — não toca em nenhuma rota ou layout existente.
 * ============================================================================
 */

const MCP_SERVER_INFO = {
  name: 'cyber-itsm-mcp',
  version: '1.0.0',
} as const;

function extractZodError(error: z.ZodError): string {
  const first = error.issues[0];
  return first
    ? `Campo "${String(first.path.join('.') || '(raiz)')}": ${first.message}`
    : 'Argumentos inválidos.';
}

export class LocalMcpServer {
  private readonly mcp: McpServer;
  private readonly definitions: McpToolDefinition[];

  constructor(definitions: McpToolDefinition[] = mcpToolsRegistry) {
    this.definitions = definitions;
    this.mcp = new McpServer(MCP_SERVER_INFO, { capabilities: { tools: {} } });

    for (const def of definitions) {
      this.mcp.registerTool(
        def.name,
        {
          title: def.title,
          description: def.description,
          inputSchema: def.inputSchema,
        },
        (args) => this.runTool(def.name, args),
      );
    }
  }

  /** Retorna as definições MCP (name, title, description, inputSchema JSON Schema). */
  listTools(): McpTool[] {
    return this.definitions.map((def) => ({
      name: def.name,
      title: def.title,
      description: def.description,
      inputSchema: z.toJSONSchema(def.inputSchema) as unknown as McpTool['inputSchema'],
    }));
  }

  /**
   * Executa uma ferramenta localmente, validando os argumentos com Zod
   * (higienização de dados) ANTES de acionar a implementação de domínio.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>,
    ctx: McpExecutionContext = { auth: null },
  ): Promise<McpToolResult> {
    const def = this.definitions.find((d) => d.name === name);
    if (!def) {
      return this.errorResult(`Ferramenta MCP "${name}" não registrada.`);
    }

    const parsed = def.inputSchema.safeParse(args ?? {});
    if (!parsed.success) {
      return this.errorResult(`Argumentos inválidos para "${name}": ${extractZodError(parsed.error)}`);
    }

    try {
      return await def.execute(parsed.data, ctx);
    } catch (err) {
      console.error(`[MCP] Falha na execução da ferramenta "${name}":`, err);
      const message = err instanceof Error ? err.message : String(err);
      return this.errorResult(`Falha ao executar "${name}": ${message}`);
    }
  }

  /** Conecta a um transporte stdio (clientes MCP externos — uso opcional). */
  async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.mcp.connect(transport);
  }

  /** Encerra o servidor MCP local. */
  async close(): Promise<void> {
    await this.mcp.close();
  }

  private async runTool(name: string, args: unknown): Promise<CallToolResult> {
    // O McpToolResult é estruturalmente compatível com o CallToolResult do
    // protocolo (content + structuredContent + isError). O cast é necessário
    // apenas por causa do índice `$loose` do schema oficial.
    return (await this.callTool(
      name,
      (args ?? {}) as Record<string, unknown>,
    )) as unknown as CallToolResult;
  }

  private errorResult(message: string): McpToolResult {
    return { content: [{ type: 'text', text: message }], isError: true };
  }
}

let instance: LocalMcpServer | null = null;

/** Singleton do MCP local — reutilizado entre requisições (zero custo extra). */
export function getLocalMcpServer(): LocalMcpServer {
  if (!instance) {
    instance = new LocalMcpServer();
  }
  return instance;
}
