import { render } from '@react-email/render';
import type { Ticket } from '@/lib/types';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/types';
import TicketNotification, {
  type TicketNotificationProps,
} from '@/components/emails/TicketNotification';
import {
  emailConfig,
  getResendClient,
  isEmailEnabled,
  resolveSender,
  resolveRecipients,
} from './resendClient';

export type TicketNotificationType = 'created' | 'updated';

/**
 * Monta a URL pública do chamado dentro do painel.
 */
function buildTicketUrl(ticketId: string): string {
  const base = emailConfig.appUrl.replace(/\/$/, '');
  return `${base}/dashboard/kanban?ticket=${ticketId}`;
}

/**
 * Lógica de envio (render + transmissão via Resend).
 *
 * Em modo sandbox: `from` é sempre 'onboarding@resend.dev' e `to` é sempre
 * `TEST_EMAIL_RECIPIENT` (verificado na conta). Nunca lança para o chamador:
 * falhas são apenas logadas. Isso garante que o fluxo principal
 * (criação/atualização de chamado) não quebre por causa de e-mail.
 */
async function sendTicketNotificationEmail(
  props: TicketNotificationProps,
  ticketRecipients: string[]
): Promise<void> {
  if (!isEmailEnabled) {
    console.debug('[email] RESEND_API_KEY não configurada; notificação ignorada.');
    return;
  }

  const client = getResendClient();
  if (!client) return;

  const to = resolveRecipients(ticketRecipients);
  if (to.length === 0) return;

  const html = await render(<TicketNotification {...props} />, { pretty: true });
  const subject =
    props.type === 'created'
      ? `[CyberITSM] Novo chamado #${props.ticketId.slice(0, 8).toUpperCase()}`
      : `[CyberITSM] Chamado #${props.ticketId.slice(0, 8).toUpperCase()} atualizado`;

  const { error } = await client.emails.send({
    from: resolveSender(),
    to,
    replyTo: emailConfig.replyTo,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Falha no envio via Resend: ${error.message}`);
  }
}

/** Dispara notificação de criação. */
export async function notifyTicketCreated(ticket: Ticket): Promise<void> {
  const recipients = collectRecipients(ticket);

  try {
    await sendTicketNotificationEmail(
      {
        type: 'created',
        ticketId: ticket.id,
        ticketUrl: buildTicketUrl(ticket.id),
        title: ticket.title,
        description: ticket.description,
        statusLabel: STATUS_LABELS[ticket.status] ?? ticket.status,
        priorityLabel: PRIORITY_LABELS[ticket.priority] ?? ticket.priority,
        frameworkOrigem: ticket.framework_origem,
        reporterName: ticket.reporter?.full_name,
        assigneeName: ticket.assignee || ticket.assignee_user?.full_name,
      },
      recipients
    );
  } catch (err) {
    console.error('[email] Erro ao notificar criação do chamado:', err);
  }
}

/** Dispara notificação de atualização. */
export async function notifyTicketUpdated(ticket: Ticket, changes: string[]): Promise<void> {
  const recipients = collectRecipients(ticket);

  try {
    await sendTicketNotificationEmail(
      {
        type: 'updated',
        ticketId: ticket.id,
        ticketUrl: buildTicketUrl(ticket.id),
        title: ticket.title,
        description: ticket.description,
        statusLabel: STATUS_LABELS[ticket.status] ?? ticket.status,
        priorityLabel: PRIORITY_LABELS[ticket.priority] ?? ticket.priority,
        frameworkOrigem: ticket.framework_origem,
        reporterName: ticket.reporter?.full_name,
        assigneeName: ticket.assignee || ticket.assignee_user?.full_name,
        changes,
      },
      recipients
    );
  } catch (err) {
    console.error('[email] Erro ao notificar atualização do chamado:', err);
  }
}

/**
 * Coleta os destinatários do chamado (reporter + responsável), evitando
 * e-mails duplicados.
 */
function collectRecipients(ticket: Ticket): string[] {
  const recipients: string[] = [];
  if (ticket.reporter?.email) recipients.push(ticket.reporter.email);
  if (ticket.assignee_user?.email) {
    recipients.push(ticket.assignee_user.email);
  } else if (ticket.assignee && ticket.assignee.includes('@')) {
    recipients.push(ticket.assignee);
  }
  return recipients;
}