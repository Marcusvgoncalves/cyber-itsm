import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Browser, type Page } from "@playwright/test";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Helpers de Supabase ADMIN (service role) usados pela suíte de Validação
 * Funcional. Permitem preparar dados de teste fora da UI (usuários, chamados,
 * estados) de forma idempotente e determinística, e autenticar um usuário
 * específico em um contexto Playwright novo (sem o storageState do admin).
 *
 * A service role key vive em `.env.local` (gitignored) — carregamos o arquivo
 * aqui porque o Playwright só carrega `tests/.env` por padrão.
 */

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "[supabase-admin] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas em .env.local."
  );
}

let _adminClient: SupabaseClient | null = null;

/** Cliente Supabase com role de serviço (bypass de RLS). */
export function adminClient(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }
  return _adminClient;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "analista" | "solicitante";
}

const TEST_PASSWORD = "CyberITSM@2026!Password";

/**
 * Garante que um usuário de teste exista (idempotente): cria em auth.users via
 * Admin API e sincroniza users_profiles com o papel e MFA (onboarding completo,
 * secret fixo para permitir o backdoor 123456 no login).
 */
export async function ensureTestUser(params: {
  email: string;
  full_name: string;
  role: TestUser["role"];
  password?: string;
}): Promise<TestUser> {
  const supabase = adminClient();
  const email = params.email.trim().toLowerCase();
  const password = params.password ?? TEST_PASSWORD;

  // 1. Tenta localizar o perfil existente.
  const { data: existing } = await supabase
    .from("users_profiles")
    .select("id, email, full_name, role")
    .eq("email", email)
    .maybeSingle();

  let userId = existing?.id ?? null;

  // 2. Se não existe, cria em auth.users (dispara o trigger de users_profiles).
  if (!userId) {
    const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: params.full_name, role: params.role },
      app_metadata: { role: params.role },
    });

    if (createError) {
      throw new Error(`[ensureTestUser] Falha ao criar ${email}: ${createError.message}`);
    }
    userId = authUser?.user?.id ?? null;
    if (!userId) throw new Error(`[ensureTestUser] Usuário criado sem id: ${email}`);
  }

  // 3. Upsert do perfil com papel + MFA completo (backdoor 123456).
  const { error: upsertError } = await supabase.from("users_profiles").upsert({
    id: userId,
    email,
    full_name: params.full_name,
    role: params.role,
    mfa_secret: "JBSWY3DPEHPK3PXP",
    mfa_setup_complete: true,
  });

  if (upsertError) {
    throw new Error(`[ensureTestUser] Falha ao atualizar perfil ${email}: ${upsertError.message}`);
  }

  return { id: userId, email, password, full_name: params.full_name, role: params.role };
}

/** Busca um usuário já existente no banco por e-mail (ou cria). */
export async function findOrCreateUser(params: {
  email: string;
  full_name: string;
  role: TestUser["role"];
}): Promise<TestUser> {
  return ensureTestUser(params);
}

/** Localiza um usuário por e-mail (id) via service role. */
export async function getUserByEmail(email: string): Promise<{ id: string } | null> {
  const { data } = await adminClient()
    .from("users_profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return data ?? null;
}

/** Insere um chamado diretamente no banco (reporter/assignee por id). */
export async function insertTicket(params: {
  title: string;
  type?: "EPICO" | "ATIVIDADE" | "TAREFA";
  status?: "ABERTO" | "EM_ANDAMENTO" | "BLOQUEADO" | "FECHADO" | "CANCELADO";
  reporterId: string;
  assigneeId?: string | null;
  parentEpicId?: string | null;
}): Promise<{ id: string }> {
  const { data, error } = await adminClient()
    .from("tickets")
    .insert({
      title: params.title,
      type: params.type ?? "TAREFA",
      status: params.status ?? "ABERTO",
      priority: "media",
      assignee: "Não atribuído",
      reporter_id: params.reporterId,
      assignee_id: params.assigneeId ?? null,
      parent_epic_id: params.parentEpicId ?? null,
      tags: [],
    })
    .select("id")
    .single();

  if (error) throw new Error(`[insertTicket] ${error.message}`);
  return data;
}

/**
 * Autentica um usuário via UI real (credenciais + MFA backdoor 123456) em um
 * contexto novo (sem storageState) e retorna a page autenticada.
 * Usado pelos testes de Matriz SoD (SOLICITANTE).
 */
export async function loginAs(browser: Browser, user: TestUser): Promise<Page> {
  const context = await browser.newContext(); // sem storageState do admin
  const page = await context.newPage();
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  const mfaInput = page.locator("#mfaCode");
  await expect(mfaInput).toBeVisible({ timeout: 30_000 });
  await mfaInput.fill("123456");
  await page.getByRole("button", { name: /Ativar e Entrar|Verificar/ }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.getByText("Quadro Kanban").first().waitFor({ state: "visible", timeout: 30_000 });

  return page;
}

/** Token único por execução para nomes de chamados de teste. */
export function unique(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
