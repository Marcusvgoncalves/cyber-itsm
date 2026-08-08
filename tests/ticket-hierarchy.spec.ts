import { test, expect } from "@playwright/test";
import {
  createTicketViaModal,
  openNewTicketModal,
  expectCardInColumn,
  fillReactInput,
} from "./helpers/ui";
import { unique } from "./helpers/supabase-admin";

/**
 * FASE 1 — Validação da hierarquia de chamados (Épico > Atividade/Tarefa).
 *
 * 1. Criação de Épico sem pai.
 * 2. Criação de Tarefa vinculada ao Épico (guarda o vínculo e exibe o Épico Pai no card).
 * 3. Guardrail de criação: Atividade/Tarefa SEM Épico Pai deve ser bloqueada.
 */
test.describe("Hierarquia de chamados", () => {
  test("cria Épico e Tarefa vinculada, exibindo o Épico Pai no card", async ({ page }) => {
    await page.goto("/dashboard");

    const epicTitle = unique("E2E Épico");
    await createTicketViaModal(page, { title: epicTitle, type: "EPICO" });
    await expectCardInColumn(page, epicTitle, "Aberto");

    const taskTitle = unique("E2E Tarefa");
    await createTicketViaModal(page, { title: taskTitle, type: "TAREFA", epicTitle });
    await expectCardInColumn(page, taskTitle, "Aberto");

    // O card da Tarefa deve exibir o link do Épico Pai.
    const taskCard = page.locator(".kanban-card", { hasText: taskTitle }).first();
    await expect(taskCard).toContainText(`Épico: ${epicTitle}`);
  });

  test("cria Atividade vinculada ao Épico com hierarquia válida", async ({ page }) => {
    await page.goto("/dashboard");

    const epicTitle = unique("E2E Épico Atividade");
    await createTicketViaModal(page, { title: epicTitle, type: "EPICO" });

    const activityTitle = unique("E2E Atividade");
    await createTicketViaModal(page, { title: activityTitle, type: "ATIVIDADE", epicTitle });

    const activityCard = page.locator(".kanban-card", { hasText: activityTitle }).first();
    await expect(activityCard).toContainText(`Épico: ${epicTitle}`);
  });

  test("bloqueia criação de Tarefa sem Épico Pai (guardrail de hierarquia)", async ({ page }) => {
    await page.goto("/dashboard");

    await openNewTicketModal(page);
    await fillReactInput(page, page.locator("#title"), unique("E2E Tarefa Órfã"));

    await page.getByRole("button", { name: "Criar Chamado" }).click();

    // A validação client-side mantém o modal aberto e exibe o erro de vínculo.
    await expect(page.getByText(/Vínculo a um Épico Pai é OBRIGATÓRIO/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("heading", { name: "Novo Chamado" })).toBeVisible();
  });
});
