import { test, expect } from "@playwright/test";
import { createTicketViaModal, kanbanColumn } from "./helpers/ui";
import { unique } from "./helpers/supabase-admin";

/**
 * FASE 1 — Copiloto de IA + botão "Testar com Security QA" (Épicos).
 *
 * 1. O Copiloto abre pela topbar, envia mensagem com mock determinístico do
 *    /api/chat e valida a proteção de UI (disabled durante streaming) e a
 *    renderização estruturada da resposta.
 * 2. O botão "Testar QA" no card de um Épico abre o modal de Teste de
 *    Segurança (EpicQaModal) com o título esperado.
 */
test.describe("Copiloto IA e Security QA", () => {
  test("Copiloto responde de forma estruturada com proteção de UI", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Abrir Copiloto de IA" }).click();

    const chatInput = page.getByPlaceholder("Pergunte sobre o chamado...");
    const sendButton = page.getByRole("button", { name: "Enviar mensagem" });
    await expect(chatInput).toBeVisible();

    // Mock determinístico do /api/chat (mesmo formato SSE do toUIMessageStreamResponse).
    await page.route("**/api/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const markdownAnswer = [
        "Top 3 controles para o chamado:\n",
        "\n",
        "- **Autenticação MFA** — exige segundo fator.\n",
        "- **Criptografia TLS 1.2+** — protege o tráfego.\n",
        "- **Logs de auditoria** — registram acessos.\n",
      ].join("");
      const events = [
        { type: "start" },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: markdownAnswer },
        { type: "text-end", id: "t1" },
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

    await chatInput.fill("Quais controles para o chamado?");
    await expect(sendButton).toBeEnabled();
    await chatInput.press("Enter");

    // Proteção de Rate Limit de front-end durante o streaming.
    await expect(chatInput).toBeDisabled();
    await expect(sendButton).toBeDisabled();

    const assistantBubbles = page.getByTestId("assistant-bubble");
    const initialCount = await assistantBubbles.count();
    await expect
      .poll(async () => assistantBubbles.count(), { timeout: 90_000 })
      .toBeGreaterThan(initialCount);

    const lastAssistant = assistantBubbles.last();
    await expect(lastAssistant).toBeVisible();
    await expect(lastAssistant.locator("ul, li").first()).toBeVisible();
  });

  test('card de Épico exibe botão "Testar QA" que abre o modal de Security QA', async ({ page }) => {
    await page.goto("/dashboard");

    const epicTitle = unique("E2E QA Épico");
    await createTicketViaModal(page, { title: epicTitle, type: "EPICO" });

    const epicCard = page.locator(".kanban-card", { hasText: epicTitle }).first();
    await expect(epicCard).toBeVisible({ timeout: 30_000 });

    // Botão "Testar QA" presente apenas em cards de Épico.
    const qaButton = epicCard.getByRole("button", { name: "Testar QA" });
    await expect(qaButton).toBeVisible();
    await qaButton.click();

    await expect(
      page.getByRole("heading", { name: "Testar Épico com Security QA" })
    ).toBeVisible();

    // Campos do modal de teste de segurança.
    await expect(page.locator("#epicEnvUrl")).toBeVisible();
    await expect(page.locator("#epicRequirements")).toBeVisible();
    await expect(page.getByRole("button", { name: "Executar Teste" })).toBeVisible();

    // Fecha o modal.
    await page.getByRole("button", { name: /Fechar|Close/i }).first().click().catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
    await expect(
      page.getByRole("heading", { name: "Testar Épico com Security QA" })
    ).not.toBeVisible({ timeout: 10_000 }).catch(() => {});
  });
});
