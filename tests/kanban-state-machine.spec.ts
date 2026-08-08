import { test, expect } from "@playwright/test";
import { createTicketViaModal, kanbanColumn, moveCardTo, dismissValidationError } from "./helpers/ui";
import { unique } from "./helpers/supabase-admin";

/**
 * FASE 1 — Validação da máquina de estados do Kanban.
 *
 * Regras (lib/domain/ticketRules.ts):
 *   ABERTO -> [EM_ANDAMENTO, CANCELADO]
 *   EM_ANDAMENTO -> [FECHADO, BLOQUEADO, CANCELADO]
 *   BLOQUEADO -> [EM_ANDAMENTO, CANCELADO]
 *   FECHADO -> [ABERTO, EM_ANDAMENTO]
 *   CANCELADO -> terminal
 *
 * Cenário: cria uma Tarefa (vinculada a um Épico) e valida transições
 * permitidas e proibidas via drag-and-drop.
 */
test.describe("Máquina de estados do Kanban", () => {
  test("ABERTO -> EM_ANDAMENTO -> FECHADO (fluxo feliz) e CANCELADO como terminal", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const epicTitle = unique("E2E SM Épico");
    await createTicketViaModal(page, { title: epicTitle, type: "EPICO" });

    const title = unique("E2E SM Tarefa");
    await createTicketViaModal(page, { title, type: "TAREFA", epicTitle });

    let card = page.locator(".kanban-card", { hasText: title }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });

    // ABERTO -> EM_ANDAMENTO (permitido)
    await moveCardTo(page, card, kanbanColumn(page, "Em Andamento"));
    await expect(kanbanColumn(page, "Em Andamento")).toContainText(title);
    await expect(kanbanColumn(page, "Aberto")).not.toContainText(title);

    // EM_ANDAMENTO -> FECHADO (permitido)
    card = page.locator(".kanban-card", { hasText: title }).first();
    await moveCardTo(page, card, kanbanColumn(page, "Fechado"));
    await expect(kanbanColumn(page, "Fechado")).toContainText(title);

    // FECHADO -> ABERTO (regra de reabertura, permitido)
    card = page.locator(".kanban-card", { hasText: title }).first();
    await moveCardTo(page, card, kanbanColumn(page, "Aberto"));
    await expect(kanbanColumn(page, "Aberto")).toContainText(title);

    // ABERTO -> CANCELADO (permitido)
    card = page.locator(".kanban-card", { hasText: title }).first();
    await moveCardTo(page, card, kanbanColumn(page, "Cancelado"));
    await expect(kanbanColumn(page, "Cancelado")).toContainText(title);

    // CANCELADO -> qualquer lugar (terminal, bloqueado)
    card = page.locator(".kanban-card", { hasText: title }).first();
    await moveCardTo(page, card, kanbanColumn(page, "Em Andamento"));
    await expect(page.getByText(/Movimento bloqueado!/)).toBeVisible({ timeout: 10_000 });
    await expect(kanbanColumn(page, "Cancelado")).toContainText(title);
    await expect(kanbanColumn(page, "Em Andamento")).not.toContainText(title);
    await dismissValidationError(page);
  });

  test("bloqueia transições inválidas (ABERTO -> FECHADO e EM_ANDAMENTO -> ABERTO)", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const epicTitle = unique("E2E SM2 Épico");
    await createTicketViaModal(page, { title: epicTitle, type: "EPICO" });

    const title = unique("E2E SM2 Tarefa");
    await createTicketViaModal(page, { title, type: "TAREFA", epicTitle });

    let card = page.locator(".kanban-card", { hasText: title }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });

    // ABERTO -> FECHADO (inválido)
    await moveCardTo(page, card, kanbanColumn(page, "Fechado"));
    await expect(page.getByText(/Movimento bloqueado!/)).toBeVisible({ timeout: 10_000 });
    await expect(kanbanColumn(page, "Aberto")).toContainText(title);
    await dismissValidationError(page);

    // ABERTO -> EM_ANDAMENTO -> tentar voltar para ABERTO (inválido)
    card = page.locator(".kanban-card", { hasText: title }).first();
    await moveCardTo(page, card, kanbanColumn(page, "Em Andamento"));
    await expect(kanbanColumn(page, "Em Andamento")).toContainText(title);

    card = page.locator(".kanban-card", { hasText: title }).first();
    await moveCardTo(page, card, kanbanColumn(page, "Aberto"));
    await expect(page.getByText(/Movimento bloqueado!/)).toBeVisible({ timeout: 10_000 });
    await expect(kanbanColumn(page, "Em Andamento")).toContainText(title);
  });

  test("BLOQUEADO -> EM_ANDAMENTO é permitido (desbloqueio)", async ({ page }) => {
    await page.goto("/dashboard");

    const epicTitle = unique("E2E SM3 Épico");
    await createTicketViaModal(page, { title: epicTitle, type: "EPICO" });

    const title = unique("E2E SM3 Tarefa");
    await createTicketViaModal(page, { title, type: "TAREFA", epicTitle });

    let card = page.locator(".kanban-card", { hasText: title }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });

    await moveCardTo(page, card, kanbanColumn(page, "Em Andamento"));
    await expect(kanbanColumn(page, "Em Andamento")).toContainText(title);

    card = page.locator(".kanban-card", { hasText: title }).first();
    await moveCardTo(page, card, kanbanColumn(page, "Bloqueado"));
    await expect(kanbanColumn(page, "Bloqueado")).toContainText(title);

    card = page.locator(".kanban-card", { hasText: title }).first();
    await moveCardTo(page, card, kanbanColumn(page, "Em Andamento"));
    await expect(kanbanColumn(page, "Em Andamento")).toContainText(title);
  });
});
