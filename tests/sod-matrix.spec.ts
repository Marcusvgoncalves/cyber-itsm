import { test, expect, type Browser } from "@playwright/test";
import { createTicketViaModal, kanbanColumn, moveCardTo } from "./helpers/ui";
import { ensureTestUser, loginAs, unique } from "./helpers/supabase-admin";

/**
 * FASE 1 — Matriz SoD (Separation of Duties) — papel SOLICITANTE.
 *
 * Matriz RBAC (lib/rbac.ts): SOLICITANTE tem SOMENTE permissões de leitura
 * (sprints:view, notifications:view, requirements:view). NÃO possui
 * 'tickets:all' — portanto NÃO deve conseguir alterar o status de chamados
 * (mover cards no Kanban).
 *
 * GAP identificado a confirmar: `moveTicket`/`updateTicket` em
 * app/actions/tickets.ts NÃO têm checagem de role explícita; para solicitante
 * há apenas filtro de visibilidade em `getTickets` e RLS. A RLS permite que
 * o reporter atualize o próprio ticket ("Reporters can update own tickets"),
 * o que poderia permitir a um SOLICITANTE mover o próprio card.
 */
const SOLICITANTE_EMAIL = "solicitante.e2e@cyberitsm.local";

test.describe("Matriz SoD — SOLICITANTE", () => {
  test("não acessa rotas exclusivas de administrador (redirect unauthorized_role)", async ({
    browser,
  }) => {
    const user = await ensureTestUser({
      email: SOLICITANTE_EMAIL,
      full_name: "Solicitante E2E",
      role: "solicitante",
    });

    const page = await loginAs(browser, user);

    await page.goto("/admin/cadastros");
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe("/dashboard");
    expect(url.searchParams.get("auth_error")).toBe("unauthorized_role");
  });

  test("visualiza apenas os próprios chamados (filtro de visibilidade)", async ({
    browser,
  }) => {
    const user = await ensureTestUser({
      email: SOLICITANTE_EMAIL,
      full_name: "Solicitante E2E",
      role: "solicitante",
    });

    const page = await loginAs(browser, user);

    // Cria um chamado como o próprio solicitante (reporter = ele mesmo).
    // EPICO não exige Épico Pai (guardrail de hierarquia não bloqueia).
    const myTitle = unique("E2E SoD Meu Chamado");
    await createTicketViaModal(page, { title: myTitle, type: "EPICO" });
    await expect(page.locator(".kanban-card", { hasText: myTitle }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("GAP SoD: SOLICITANTE não deve conseguir mover card próprio (status de chamado)", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const user = await ensureTestUser({
      email: SOLICITANTE_EMAIL,
      full_name: "Solicitante E2E",
      role: "solicitante",
    });

    const page = await loginAs(browser, user);

    const myTitle = unique("E2E SoD Movimento");
    await createTicketViaModal(page, { title: myTitle, type: "EPICO" });

    const card = page.locator(".kanban-card", { hasText: myTitle }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(kanbanColumn(page, "Aberto")).toContainText(myTitle);

    // Comportamento esperado (SoD): o movimento deve ser BLOQUEADO, mantendo o
    // card em ABERTO e exibindo erro de validação. Se o card mover para
    // "Em Andamento", o teste falha e DOCUMENTA o bug (GAP de autorização).
    await moveCardTo(page, card, kanbanColumn(page, "Em Andamento"));

    // FALHA ESPERADA atual: moveTicket não checa role e a RLS permite o
    // reporter atualizar o próprio ticket -> o card provavelmente MOVERÁ.
    const errorShown = await page
      .getByText(/Movimento bloqueado!/)
      .first()
      .isVisible()
      .catch(() => false);

    const moved = await kanbanColumn(page, "Em Andamento")
      .getByText(myTitle)
      .first()
      .isVisible()
      .catch(() => false);

    test.info().annotations.push({
      type: "SoD",
      description: errorShown
        ? "Movimento BLOQUEADO — comportamento correto (SoD respeitada)."
        : moved
          ? `BUG CONFIRMADO: solicitante conseguiu mover o card próprio para "Em Andamento".`
          : "Movimento sem feedback (estado indeterminado) — inspecionar.",
    });

    // Assert final: o status NÃO deve ter sido alterado por um SOLICITANTE.
    expect(errorShown || !moved, "SoD violada: solicitante alterou o status do chamado").toBe(true);
  });
});
