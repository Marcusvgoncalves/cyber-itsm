import type { CSSProperties } from 'react';
import {
Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

/**
 * Template transacional de notificação de chamado (criação/atualização).
 *
 * Design corporativo e responsivo, renderizado com React Email. Os rótulos de
 * status/prioridade chegam já formatados para manter o template 100% de
 * apresentação (sem regras de negócio aqui).
 */
export interface TicketNotificationProps {
  type: 'created' | 'updated';
  ticketId: string;
  ticketUrl: string;
  title: string;
  description?: string | null;
  statusLabel: string;
  priorityLabel: string;
  frameworkOrigem?: string | null;
  reporterName?: string | null;
  assigneeName?: string | null;
  /** Lista de alterações exibida apenas quando type === 'updated'. */
  changes?: string[];
  appName?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  Baixa: '#1a9e5c',
  Média: '#b98900',
  Alta: '#e8590c',
  Crítica: '#d92d20',
};

export default function TicketNotification({
  type,
  ticketId,
  ticketUrl,
  title,
  description,
  statusLabel,
  priorityLabel,
  frameworkOrigem,
  reporterName,
  assigneeName,
  changes = [],
  appName = 'CyberITSM SPN',
}: TicketNotificationProps) {
  const isCreated = type === 'created';
  const priorityColor = PRIORITY_COLORS[priorityLabel] ?? '#4f6ef7';
  const summary = isCreated
    ? 'Um novo chamado foi registrado na plataforma.'
    : 'O chamado abaixo foi atualizado.';

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`${isCreated ? 'Novo chamado' : 'Atualização de chamado'}: ${title}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Row>
              <Text style={headerBrand}>{appName}</Text>
            </Row>
            <Row>
              <Text style={headerTagline}>Plataforma de IT Service Management</Text>
            </Row>
          </Section>

          {/* Corpo */}
          <Section style={content}>
            <Heading style={h1}>{summary}</Heading>
            <Text style={paragraph}>
              Olá{reporterName ? `, ${reporterName}` : ''}. Segue o resumo do
              chamado registrado no {appName}.
            </Text>

            <Section style={ticketBox}>
              <Row>
                <Text style={ticketCode}>#{ticketId.slice(0, 8).toUpperCase()}</Text>
                <Text style={ticketTitle}>{title}</Text>
              </Row>
              {description ? (
                <Text style={ticketDescription}>{description}</Text>
              ) : null}
            </Section>

            <Section style={metaGrid}>
              <Row>
                <Column style={metaColumn}>
                  <Text style={metaLabel}>Status</Text>
                  <Text style={metaValue}>{statusLabel}</Text>
                </Column>
                <Column style={metaColumn}>
                  <Text style={metaLabel}>Prioridade</Text>
                  <Text style={{ ...metaValue, color: priorityColor }}>
                    {priorityLabel}
                  </Text>
                </Column>
              </Row>
              <Row>
                <Column style={metaColumn}>
                  <Text style={metaLabel}>Framework</Text>
                  <Text style={metaValue}>{frameworkOrigem ?? '—'}</Text>
                </Column>
                <Column style={metaColumn}>
                  <Text style={metaLabel}>Responsável</Text>
                  <Text style={metaValue}>{assigneeName ?? 'A definir'}</Text>
                </Column>
              </Row>
            </Section>

            {!isCreated && changes.length > 0 ? (
              <>
                <Hr style={hr} />
                <Text style={changesTitle}>Alterações realizadas:</Text>
                {changes.map((change, index) => (
                  <Text key={index} style={changeItem}>
                    • {change}
                  </Text>
                ))}
              </>
            ) : null}

            <Section style={ctaSection}>
              <Button href={ticketUrl} style={ctaButton}>
                Abrir chamado no painel
              </Button>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Este é um e-mail automático gerado pelo {appName}. Não responda a
              esta mensagem.
            </Text>
            <Text style={footerTextMuted}>
              © 2026 {appName} · Cyber Security Platform
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: CSSProperties = {
  backgroundColor: '#f4f6fb',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: '0',
};

const container: CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  overflow: 'hidden',
  border: '1px solid #e5e9f2',
};

const header: CSSProperties = {
  backgroundColor: '#0b1f3a',
  padding: '28px 32px',
};

const headerBrand: CSSProperties = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 700,
  margin: 0,
  letterSpacing: '-0.02em',
};

const headerTagline: CSSProperties = {
  color: '#9fb3d1',
  fontSize: '12px',
  margin: '2px 0 0 0',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const content: CSSProperties = {
  padding: '32px',
};

const h1: CSSProperties = {
  color: '#0b1f3a',
  fontSize: '20px',
  lineHeight: '28px',
  fontWeight: 700,
  margin: '0 0 12px 0',
};

const paragraph: CSSProperties = {
  color: '#475467',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 20px 0',
};

const ticketBox: CSSProperties = {
  backgroundColor: '#f8fafc',
  borderLeft: '4px solid #4f6ef7',
  borderRadius: '8px',
  padding: '16px 20px',
  marginBottom: '24px',
};

const ticketCode: CSSProperties = {
  color: '#4f6ef7',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  margin: '0 0 4px 0',
};

const ticketTitle: CSSProperties = {
  color: '#0b1f3a',
  fontSize: '16px',
  fontWeight: 600,
  lineHeight: '24px',
  margin: 0,
};

const ticketDescription: CSSProperties = {
  color: '#475467',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '8px 0 0 0',
};

const metaGrid: CSSProperties = {
  border: '1px solid #e5e9f2',
  borderRadius: '8px',
  padding: '12px 16px',
};

const metaColumn: CSSProperties = {
  width: '50%',
  padding: '8px 0',
  verticalAlign: 'top',
};

const metaLabel: CSSProperties = {
  color: '#98a2b3',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '0 0 2px 0',
};

const metaValue: CSSProperties = {
  color: '#0b1f3a',
  fontSize: '13px',
  fontWeight: 600,
  margin: 0,
};

const hr: CSSProperties = {
  border: 'none',
  borderTop: '1px solid #e5e9f2',
  margin: '24px 0',
};

const changesTitle: CSSProperties = {
  color: '#0b1f3a',
  fontSize: '14px',
  fontWeight: 600,
  margin: '0 0 8px 0',
};

const changeItem: CSSProperties = {
  color: '#475467',
  fontSize: '13px',
  lineHeight: '22px',
  margin: '0 0 4px 0',
};

const ctaSection: CSSProperties = {
  textAlign: 'center',
  marginTop: '28px',
};

const ctaButton: CSSProperties = {
  backgroundColor: '#4f6ef7',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '12px 28px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
};

const footer: CSSProperties = {
  padding: '20px 32px',
  borderTop: '1px solid #e5e9f2',
  textAlign: 'center',
};

const footerText: CSSProperties = {
  color: '#98a2b3',
  fontSize: '11px',
  lineHeight: '18px',
  margin: '0 0 4px 0',
};

const footerTextMuted: CSSProperties = {
  color: '#c0c8d4',
  fontSize: '10px',
  margin: 0,
};

