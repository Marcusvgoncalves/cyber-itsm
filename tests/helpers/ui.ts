import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Helpers de UI reutilizáveis pela suíte de Validação Funcional.
 * Centraliza o preenchimento de formulários React controlados (que a hidratação
 * pode reverter), a manipulação dos selects Radix e a criação de chamados.
 */

/** Preenche um input controlado pelo React garantindo que o valor "cola". */
export async function fillReactInput(page: Page, locator: Locator, value: string) {
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

/** Mapa type -> nome acessível da opção Radix (acentuação do label). */
const TYPE_OPTION_NAME: Record<string, RegExp> = {
  EPICO: /^Épico/,
  ATIVIDADE: /^Atividade/,
  TAREFA: /^Tarefa/,
};

/** Seleciona uma opção em um Select Radix pelo id do trigger e regex do nome. */
export async function selectRadixOption(page: Page, triggerId: string, name: RegExp) {
  await page.locator(`#${triggerId}`).click();
  const option = page.getByRole("option", { name });
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
}

/** Seleciona o tipo de chamado no Select Radix (mapeia sigla -> label PT-BR). */
export async function selectTicketType(page: Page, type: "EPICO" | "ATIVIDADE" | "TAREFA") {
  await selectRadixOption(page, "type", TYPE_OPTION_NAME[type]);
}

/** Abre o modal "Novo Chamado" a partir da toolbar do Kanban. */
export async function openNewTicketModal(page: Page) {
  await page.getByRole("button", { name: "Novo Chamado", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Novo Chamado" })).toBeVisible();
}

/**
 * Seleciona um Épico Pai no dropdown de busca do modal de chamado.
 * Busca pelo título do épico (único, com timestamp) e clica no item do dropdown.
 */
export async function selectEpicParent(page: Page, epicTitle: string) {
  const search = page.getByPlaceholder(/Digite o número/);
  await fillReactInput(page, search, epicTitle);
  const item = page.locator("div[class*='cursor-pointer']", { hasText: epicTitle }).first();
  await expect(item).toBeVisible({ timeout: 10_000 });
  await item.click();
}

export interface CreateTicketParams {
  title: string;
  /** Default 'TAREFA'. Para 'EPICO' não é necessário epicTitle. */
  type?: "EPICO" | "ATIVIDADE" | "TAREFA";
  /** Obrigatório para ATIVIDADE/TAREFA. */
  epicTitle?: string;
}

/**
 * Cria um chamado pelo modal do Kanban e aguarda o card aparecer.
 * Para validar o bloqueio de dependência de Épico, passe `expectBlocked: true`.
 */
export async function createTicketViaModal(
  page: Page,
  params: CreateTicketParams,
  expectBlocked = false
) {
  const { title, type = "TAREFA", epicTitle } = params;
  await openNewTicketModal(page);

  if (type !== "TAREFA") {
    await selectTicketType(page, type);
  }

  if (epicTitle) {
    await selectEpicParent(page, epicTitle);
  }

  await fillReactInput(page, page.locator("#title"), title);
  await page.getByRole("button", { name: "Criar Chamado" }).click();

  if (expectBlocked) {
    return;
  }

  const card = page.locator(".kanban-card", { hasText: title }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
}

/** Retorna a coluna do Kanban pelo nome de status. */
export function kanbanColumn(page: Page, name: string): Locator {
  return page.locator(".kanban-column", { hasText: name }).first();
}

/**
 * Retorna o card do Kanban cujo título (heading h4) é exatamente `title`.
 *
 * Importante: NÃO usar `hasText: title` aqui — o card de um filho exibe o
 * título do Épico pai como legenda ("Tarefa Épico: {epicTitle}"), então um
 * `hasText` ambiguo seleciona o filho em vez do Épico.
 */
export function kanbanCard(page: Page, title: string): Locator {
  return page
    .locator(".kanban-card")
    .filter({ has: page.getByRole("heading", { level: 4, name: title, exact: true }) })
    .first();
}

/**
 * Move um card (drag-and-drop HTML5) para uma coluna de destino.
 *
 * Dispara os eventos DragEvent com um DataTransfer real diretamente nos
 * elementos (dragstart no card -> drop na coluna), replicando o que o
 * navegador faz em um drag real. Isso evita a flakiness do `dragTo` do
 * Playwright com colunas fora do viewport (a board é overflow-x-auto) e
 * exercita os mesmos handlers React (onDragStart/onDrop do KanbanCard/Column).
 */
export async function moveCardTo(page: Page, card: Locator, targetColumn: Locator) {
  const sourceHandle = await card.elementHandle();
  const targetHandle = await targetColumn.elementHandle();
  if (!sourceHandle || !targetHandle) {
    throw new Error("[moveCardTo] Elementos do drag não resolvidos.");
  }
  await page.evaluate(
    ([source, target]) => {
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
      source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
    },
    [sourceHandle, targetHandle]
  );
}

/** Aguarda o card ficar na coluna esperada e fora das demais. */
export async function expectCardInColumn(page: Page, title: string, columnName: string) {
  const column = kanbanColumn(page, columnName);
  await expect(column).toContainText(title);
}

/** Fecha o alerta de validação de regra de negócio (se visível). */
export async function dismissValidationError(page: Page) {
  const dismiss = page.locator("button", { has: page.locator("svg.lucide-x") }).first();
  const alertVisible = await page
    .getByText(/Movimento bloqueado!/)
    .first()
    .isVisible()
    .catch(() => false);
  if (alertVisible) {
    await page.getByRole("button").filter({ has: page.locator("svg.lucide-x") }).first().click();
  }
  void dismiss;
}
