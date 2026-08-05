import { Resend } from 'resend';

/**
 * MODO SANDBOX (Resend sem domínio em produção).
 *
 * Enquanto não validarmos um domínio, o envio é RESTRITO:
 *  - `from` é OBRIGATORIAMENTE 'onboarding@resend.dev' (domínio sandbox).
 *  - `to` consome OBRIGATORIAMENTE `process.env.TEST_EMAIL_RECIPIENT`
 *    (o e-mail verificado na conta Resend — único que recebe em sandbox).
 *
 * O modo sandbox é o padrão. Para produção, defina `EMAIL_MODE=production`
 * e valide um domínio em https://resend.com/domains.
 */
export const SENDER_SANDBOX = 'onboarding@resend.dev';

/**
 * Configuração global de e-mail transacional.
 *
 * Toda a configuração é determinada por variáveis de ambiente, mantendo o
 * utilitário agnóstico em relação ao provedor (hoje Resend, mas a interface
 * é a mesma para qualquer provedor SMTP/API). NUNCA hardcode chaves de API.
 */
export const emailConfig = {
  /** Modo de operação: 'sandbox' (padrão) ou 'production'. */
  mode: (process.env.EMAIL_MODE ?? 'sandbox') as 'sandbox' | 'production',
  /** Remetente usado em produção (domínio verificado). */
  fromProduction: process.env.EMAIL_FROM ?? 'CyberITSM SPN <onboarding@resend.dev>',
  /** Remetente obrigatório no modo sandbox. */
  fromSandbox: SENDER_SANDBOX,
  /** Destinatário obrigatório no modo sandbox. */
  recipientSandbox: process.env.TEST_EMAIL_RECIPIENT,
  /** Responder-para opcional (suporte, mesa de ajuda etc.). */
  replyTo: process.env.EMAIL_REPLY_TO,
  /** Nome da aplicação exibido nos templates. */
  appName: process.env.EMAIL_APP_NAME ?? 'CyberITSM SPN',
  /** URL base usada para montar CTAs e links no template. */
  appUrl:
    process.env.EMAIL_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000',
};

/**
 * Resolve o remetente conforme o modo:
 *  - sandbox -> OBRIGATORIAMENTE 'onboarding@resend.dev'
 *  - production -> EMAIL_FROM
 */
export function resolveSender(): string {
  return emailConfig.mode === 'production'
    ? emailConfig.fromProduction
    : emailConfig.fromSandbox;
}

/**
 * Resolve os destinatários conforme o modo:
 *  - sandbox -> OBRIGATORIAMENTE `process.env.TEST_EMAIL_RECIPIENT`
 *  - production -> lista recebida do chamado
 */
export function resolveRecipients(ticketRecipients: string[]): string[] {
  if (emailConfig.mode === 'production') {
    return [...new Set(ticketRecipients.filter(Boolean))];
  }

  const recipient = emailConfig.recipientSandbox?.trim();
  if (!recipient) {
    console.warn('[email] TEST_EMAIL_RECIPIENT não configurada; envio em sandbox ignorado.');
    return [];
  }

  return [recipient];
}

/** True quando a chave de API foi fornecida (habilita o disparo). */
export const isEmailEnabled = Boolean(process.env.RESEND_API_KEY);

let client: Resend | null = null;

/**
 * Cliente Resend singleton, criado de forma preguiçosa (lazy).
 *
 * Retorna `null` quando a chave de API não está configurada, permitindo que o
 * sistema degrade silenciosamente em desenvolvimento sem travar a aplicação.
 */
export function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }

  return client;
}