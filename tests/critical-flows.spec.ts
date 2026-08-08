import { test, expect, type Locator, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Suíte E2E / Usabilidade — Fluxos Críticos do CyberITSM.
 *
 * Pré-requisitos de ambiente:
 *   - Dev server em http://localhost:3000 (o webServer do config inicia via `npm run dev`);
 *   - Supabase configurado (URL/anon key em .env.local) com o schema aplicado
 *     (supabase-schema.sql + supabase-security-qa.sql — buckets qa-temp-evidences / qa-logs-archive);
 *   - Usuário válido com MFA (o global-setup autentica via código sandbox "123456");
 *   - Ao menos uma chave de IA configurada (GROQ_API_KEY / OPENROUTER_API_KEY /
 *     GEMINI_API_KEY) para a esteira do Copiloto e do Security QA (fallback determinístico presente).
 *
 * As três missões abaixo cobrem: upload+relatório (Security QA), interação de UI
 * (Kanban com drag-and-drop) e proteção de UI + renderização estruturada (Copiloto IA).
 */

const SECURITY_REPORT_FIXTURE = path.resolve(__dirname, "fixtures", "security-report.json");
const MOCK_PROJECT_NAME = `E2E Security QA ${Date.now()}`;

/**
 * Preenche um input controlado pelo React garantindo que o valor "cola".
 * No WebKit, um fill disparado antes da hidratação terminar é descartado quando
 * o React re-renderiza o input (valor controlado volta ao estado inicial).
 * Este helper refaz o fill até que `inputValue()` confirme o valor aplicado.
 */
async function fillReactInput(page: Page, locator: Locator, value: string) {
  await expect
    .poll(
      async () => {
        await locator.fill(value);
        return (await locator.inputValue()) === value;
      },
      { timeout: 10_000 }
    )
    .toBe(true);
}

/**
 * Preenche os três campos do formulário de Security QA.
 */
async function fillAssessForm(page: Page, projectName: string) {
  await fillReactInput(page, page.locator("#projectName"), projectName);
  await fillReactInput(
    page,
    page.locator("#environmentUrl"),
    "https://homologacao.corporativo.com.br"
  );
  await fillReactInput(
    page,
    page.locator("#requirements"),
    "VIVO.SEGURA.AUT.01 - Autenticação MFA obrigatória\n" +
      "VIVO.SEGURA.CRIP.02 - Tráfego TLS 1.2+\n" +
      "VIVO.SEGURA.LOG.03 - Logs de auditoria centralizados"
  );
}

test.describe("Fluxos críticos de usabilidade", () => {
  test("MISSÃO A — Centro de Security QA: upload de evidência JSON, análise e relatório PDF", async ({
    page,
  }) => {
    await page.goto("/security-qa/assess");

    // 1. Preenche identificação do projeto. No WebKit, fills disputados com a
    // hidratação React podem ser revertidos por re-renders subsequentes — por
    // isso o formulário é preenchido com retry global até o botão habilitar.
    await fillAssessForm(page, MOCK_PROJECT_NAME);

    // 2. Simula a inserção de um arquivo JSON (mock) no input de upload.
    await page.locator('input[type="file"]').setInputFiles(SECURITY_REPORT_FIXTURE);

    // 3. Aguarda o upload confirmado no bucket temporário.
    await expect(page.getByText(/enviado para/)).toBeVisible({ timeout: 30_000 });

    // 4. Garante os campos preenchidos e o botão habilitado (refaz fills se a
    // hidratação tiver revertido algum valor).
    const runButton = page.getByRole("button", { name: "Executar Análise" });
    await expect(async () => {
      await fillAssessForm(page, MOCK_PROJECT_NAME);
      await expect(runButton).toBeEnabled();
    }).toPass({ timeout: 30_000 });

    // 5. Clica no botão de processamento da análise.
    await runButton.click();

    // 6. Aguarda a conclusão do pipeline e a navegação para o relatório do projeto.
    await page.waitForURL(/\/security-qa\/project\//, { timeout: 120_000 });

    // 7. Valida a renderização do Score de Conformidade.
    const scoreCard = page.locator("text=Conformidade").first();
    await expect(scoreCard).toBeVisible();

    // 8. Valida o botão de geração do relatório PDF (visível e clicável).
    const pdfButton = page.getByRole("button", { name: "Exportar PDF" });
    await expect(pdfButton).toBeVisible();
    await expect(pdfButton).toBeEnabled();
  });

  test("MISSÃO B — Quadro Kanban: criar chamado e mover o card via drag-and-drop", async ({ page }) => {
    await page.goto("/dashboard");

    // 1. Abre o modal de novo chamado.
    await page.getByRole("button", { name: "Novo Chamado", exact: true }).click();

    // 2. Preenche um título fictício e salva.
    const ticketTitle = `E2E Chamado ${Date.now()}`;
    await page.locator("#title").fill(ticketTitle);
    await page.getByRole("button", { name: "Criar Chamado" }).click();

    // 3. Aguarda o card criado na coluna "Aberto".
    const card = page.locator(".kanban-card", { hasText: ticketTitle });
    await expect(card).toBeVisible({ timeout: 30_000 });

    const abertoColumn = page.locator(".kanban-column", { hasText: "Aberto" }).first();
    await expect(abertoColumn).toContainText(ticketTitle);

    // 4. Arrasta o card da coluna "Aberto" para a coluna "Em Andamento".
    const emAndamentoColumn = page.locator(".kanban-column", { hasText: "Em Andamento" }).first();
    await card.dragTo(emAndamentoColumn);

    // 5. Valida que o card permaneceu na nova coluna (e saiu da origem).
    await expect(emAndamentoColumn).toContainText(ticketTitle);
    await expect(abertoColumn).not.toContainText(ticketTitle);
  });

  test("MISSÃO C — Copiloto IA: proteção de UI (disabled) e resposta estruturada em tópicos", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // 1. Abre o Copiloto pela topbar (aria-label dedicado).
    await page.getByRole("button", { name: "Abrir Copiloto de IA" }).click();

    const chatInput = page.getByPlaceholder("Pergunte sobre o chamado...");
    const sendButton = page.getByRole("button", { name: "Enviar mensagem" });
    await expect(chatInput).toBeVisible();

    // 1.1 Mock DETERMINÍSTICO de /api/chat: a esteira de IA real depende de
    // chaves/quota de provedores gratuitos (groq/openrouter/google), o que torna
    // a suíte não-determinística. Servimos um stream SSE no mesmo formato do
    // `toUIMessageStreamResponse` (data: {json}, chunks text-start/delta/end,
    // finish e [DONE]) com resposta markdown em tópicos. O atraso de 2.5s
    // expõe, de forma estável, a janela de "streaming" (input + botão disabled).
    await page.route("**/api/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const markdownAnswer = [
        "Principais ameaças de um bucket S3 público:\n",
        "\n",
        "- **Exposição de dados** — objetos legíveis por qualquer pessoa com o link.\n",
        "- **Acesso anônimo (IAM)** — políticas que permitem `s3:GetObject` para `*`.\n",
        "- **Enumerabilidade** — listagem aberta expõe nomes de buckets e estrutura.\n",
        "- **Custo e abuso** — download massivo gera cobrança inesperada na conta.\n",
      ].join("");
      const events = [
        { type: "start" },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: markdownAnswer },
        { type: "text-end", id: "text-1" },
        { type: "finish", finishReason: "stop" },
        "[DONE]",
      ];
      const body = events.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("");
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Vercel-Ai-Ui-Message-Stream": "v1",
        },
        body,
      });
    });

    // 2. Digita a pergunta e envia (Enter: o FAB do dashboard, fixed bottom-6
    // right-6 z-40, sobrepõe o botão de envio — ver nota de stacking context).
    const question = "Quais as ameaças de um S3 público?";
    await chatInput.fill(question);
    await expect(sendButton).toBeEnabled();
    await chatInput.press("Enter");

    // 3. Valida IMEDIATAMENTE a proteção de Rate Limit de front-end: input e
    // botão de envio ficam com atributo 'disabled' durante o streaming.
    await expect(chatInput).toBeDisabled();
    await expect(sendButton).toBeDisabled();

    // 4. Aguarda a resposta da IA (contagem de mensagens do assistente aumenta).
    const assistantBubbles = page.getByTestId("assistant-bubble");
    const initialAssistantCount = await assistantBubbles.count();
    await expect
      .poll(async () => assistantBubbles.count(), { timeout: 90_000 })
      .toBeGreaterThan(initialAssistantCount);

    // 5. Valida a resposta estruturada em tópicos: tags de lista (<ul> ou <li>)
    // na última mensagem do assistente, confirmando a renderização markdown.
    const lastAssistant = assistantBubbles.last();
    await expect(lastAssistant).toBeVisible();
    await expect(lastAssistant.locator("ul, li").first()).toBeVisible();
  });
});
