import { chromium } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "tests", ".env") });

/**
 * GLOBAL SETUP — Estratégia de bypass de autenticação.
 *
 * Realiza UMA autenticação real (credenciais + MFA TOTP) e persiste a sessão
 * no arquivo `tests/.auth/user.json`. Todos os testes reutilizam esse estado
 * via `storageState`, navegando direto para os módulos sem repetir o fluxo de
 * login (que inclui MFA obrigatório) a cada execução.
 *
 * Credenciais em `tests/.env` (gitignored) ou variáveis de ambiente:
 *   E2E_BASE_URL, E2E_USER, E2E_PASSWORD
 *   E2E_MFA_TOTP_SECRET  -> gera o código TOTP real no momento do login
 *   E2E_MFA_CODE         -> fallback (padrão: 123456, backdoor da sandbox)
 *
 * O fluxo cobre tanto o primeiro acesso (MFA_ONBOARDING) quanto usuários já
 * configurados (MFA_VERIFICATION), tentando os códigos candidatos em ordem.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const E2E_USER = process.env.E2E_USER ?? "marcus.goncalves";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "CyberItsm@2026!";
const E2E_MFA_TOTP_SECRET = process.env.E2E_MFA_TOTP_SECRET;
const E2E_MFA_CODE = process.env.E2E_MFA_CODE ?? "123456";

const AUTH_DIR = path.join(__dirname, ".auth");
const AUTH_STATE_PATH = path.join(AUTH_DIR, "user.json");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = "";
  for (const ch of clean) {
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val === -1) throw new Error(`Caractere base32 inválido no segredo MFA: "${ch}"`);
    bits += val.toString(2).padStart(5, "0");
  }
  const buf = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(bits.substring(i * 8, (i + 1) * 8), 2);
  }
  return buf;
}

/** Gera o código TOTP (RFC 6238, HMAC-SHA1, 30s, 6 dígitos). */
function generateTOTP(secret: string, timeWindowOffset = 0): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + timeWindowOffset;
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binCode % 1_000_000).toString().padStart(6, "0");
}

/** Candidatos de código MFA, em ordem de prioridade. */
function buildMfaCandidates(): string[] {
  const candidates: string[] = [];
  if (E2E_MFA_TOTP_SECRET) {
    candidates.push(generateTOTP(E2E_MFA_TOTP_SECRET));
    candidates.push(generateTOTP(E2E_MFA_TOTP_SECRET, -1));
    candidates.push(generateTOTP(E2E_MFA_TOTP_SECRET, 1));
  }
  if (E2E_MFA_CODE && !candidates.includes(E2E_MFA_CODE)) {
    candidates.push(E2E_MFA_CODE);
  }
  return candidates;
}

export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // networkidle evita a corrida de hidratação do React no primeiro acesso ao
    // dev server (que compila a rota /login) antes de interagir com o form.
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

    await page.locator("#email").fill(E2E_USER);
    await page.locator("#password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    // Passo MFA (onboarding ou verificação) — ambos expõem #mfaCode.
    // Aguarda o avanço OU um erro visível no formulário (diagnóstico claro).
    const mfaInput = page.locator("#mfaCode");
    await Promise.race([
      mfaInput.waitFor({ state: "visible", timeout: 30_000 }),
      page
        .locator(".text-destructive")
        .first()
        .waitFor({ state: "visible", timeout: 30_000 })
        .then(() =>
          Promise.reject(
            new Error("Formulário de login exibiu erro (credenciais/MFA inválidas).")
          )
        ),
    ]);

    let authenticated = false;
    for (const code of buildMfaCandidates()) {
      await page.locator("#mfaCode").fill(code);
      await page.getByRole("button", { name: /Ativar e Entrar|Verificar/ }).click();
      try {
        await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
        authenticated = true;
        break;
      } catch {
        // Código rejeitado — a tela permanece no passo MFA; tenta o próximo.
      }
    }

    if (!authenticated) {
      throw new Error("Nenhum código MFA candidato foi aceito.");
    }

    await page.getByText("Quadro Kanban").first().waitFor({ state: "visible", timeout: 30_000 });

    await page.context().storageState({ path: AUTH_STATE_PATH });
    console.log(`[global-setup] Sessão autenticada salva em ${AUTH_STATE_PATH}`);
  } catch (err) {
    const hints: string[] = [];
    try {
      await page.screenshot({ path: path.join(AUTH_DIR, "login-failure.png"), fullPage: true });
      hints.push(`Screenshot: ${path.join(AUTH_DIR, "login-failure.png")}`);
    } catch {
      /* ignorado */
    }
    try {
      const screenErrors = await page
        .locator(".text-destructive, [class*='bg-destructive']")
        .allTextContents();
      if (screenErrors.length > 0) hints.push(`Mensagem na tela: ${screenErrors.join(" | ")}`);
    } catch {
      /* ignorado */
    }
    hints.push(`URL atual: ${page.url()}`);

    throw new Error(
      `[global-setup] Falha ao autenticar como "${E2E_USER}". ${hints.join(" ")}. Verifique credenciais/MFA em tests/.env (o dev server deve estar ativo). Erro base: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    await browser.close();
  }
}
