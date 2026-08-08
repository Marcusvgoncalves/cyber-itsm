import React from "react";
import ReactPDF, { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Ticket } from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#660099",
    paddingBottom: 8,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#660099",
  },
  headerSub: {
    fontSize: 8,
    color: "#64748b",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#475569",
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 8,
  },
  kpiLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  kpiVal: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#660099",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#660099",
    marginTop: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#660099",
    paddingLeft: 6,
  },
  descBox: {
    backgroundColor: "#faf5ff",
    borderWidth: 1,
    borderColor: "#e9d5ff",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    fontSize: 9.5,
    lineHeight: 1.5,
    color: "#3b0764",
  },
  requirementBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  reqTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#166534",
    marginBottom: 2,
  },
  reqText: {
    fontSize: 8.5,
    color: "#15803d",
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#94a3b8",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export function TicketPdfDocument({ ticket, requirementOpinion }: { ticket: Ticket; requirementOpinion?: string }) {
  return (
    <Document title={`Parecer de Requisitos — Ticket ${ticket.id.slice(0, 8)}`} author="CyberITSM SPN">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CyberITSM SPN · Quadro Kanban</Text>
          <Text style={styles.headerSub}>Parecer Técnico &amp; Direcionamento de Requisitos SD v4.1</Text>
        </View>

        <Text style={styles.title}>{ticket.title}</Text>
        <Text style={styles.subtitle}>
          Código: SPN-{ticket.id.slice(-6).toUpperCase()} · Data de Abertura: {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
        </Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Tipo</Text>
            <Text style={styles.kpiVal}>{ticket.type || "TAREFA"}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Status</Text>
            <Text style={styles.kpiVal}>{ticket.status ? ticket.status.toUpperCase() : "ABERTO"}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Prioridade</Text>
            <Text style={[styles.kpiVal, { color: ticket.priority === "critica" ? "#dc2626" : "#660099" }]}>
              {ticket.priority.toUpperCase()}
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Responsável</Text>
            <Text style={styles.kpiVal}>{ticket.assignee || "Não atribuído"}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Descrição da Solução / Demanda</Text>
        <View style={styles.descBox}>
          <Text>{ticket.description || "Nenhuma descrição detalhada informada."}</Text>
        </View>

        <Text style={styles.sectionTitle}>Parecer Autônomo de Requisitos (SD v4.1)</Text>
        <View style={styles.requirementBox}>
          <Text style={styles.reqTitle}>Direcionamento Normativo Recomendado</Text>
          <Text style={styles.reqText}>
            {requirementOpinion ||
              `Com base no escopo e no framework ${ticket.framework_origem || "NIST"}, aplica-se obrigatoriamente a diretriz VIVO.SEGURA.AUT.01 (MFA TOTP), VIVO.SEGURA.CRIP.02 (TLS 1.3) e os controles de auditoria imutável VIVO.SEGURA.LOG.03.`}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>CyberITSM SPN · Documento Gerado com Validação Forense e Análise Multiagente</Text>
          <Text>Página 1</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateTicketPdfBuffer(ticket: Ticket, requirementOpinion?: string): Promise<Buffer> {
  return await ReactPDF.renderToBuffer(<TicketPdfDocument ticket={ticket} requirementOpinion={requirementOpinion} />);
}
