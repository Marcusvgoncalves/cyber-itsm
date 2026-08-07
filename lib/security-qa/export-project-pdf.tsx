import React from "react";
import ReactPDF, { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { QaResult } from "./types";

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
    fontSize: 20,
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
    fontSize: 14,
    fontWeight: "bold",
    color: "#660099",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#660099",
    marginTop: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#660099",
    paddingLeft: 6,
  },
  summaryBox: {
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
  findingCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  findingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  findingId: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#0f172a",
  },
  badgeConforme: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#15803d",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeParcial: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#b45309",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeNaoConforme: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  findingText: {
    fontSize: 8.5,
    color: "#334155",
    lineHeight: 1.4,
    marginBottom: 3,
  },
  findingRec: {
    fontSize: 8.5,
    color: "#4338ca",
    fontWeight: "bold",
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

export function QaProjectPdfDocument({ result }: { result: QaResult }) {
  const conformeCount = result.findings.filter((f) => f.status === "conforme").length;
  const parcialCount = result.findings.filter((f) => f.status === "parcial").length;
  const naoConformeCount = result.findings.filter((f) => f.status === "nao_conforme").length;

  return (
    <Document title={`Laudo Security QA — ${result.project_name}`} author="CyberITSM SPN">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CyberITSM SPN · Centro de Security QA</Text>
          <Text style={styles.headerSub}>Laudo Executivo de Auditoria de Conformidade</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{result.project_name}</Text>
        <Text style={styles.subtitle}>Ambiente: {result.environment_url} · Data: {new Date(result.created_at).toLocaleDateString("pt-BR")}</Text>

        {/* Top KPIs */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Conformidade</Text>
            <Text style={styles.kpiVal}>{Number(result.compliance_percent).toFixed(1)}%</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Rating de Risco</Text>
            <Text style={[styles.kpiVal, { color: result.overall_rating === "critico" ? "#ef4444" : "#660099" }]}>
              {result.overall_rating.toUpperCase()}
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Conformes</Text>
            <Text style={[styles.kpiVal, { color: "#16a34a" }]}>{conformeCount}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Parciais</Text>
            <Text style={[styles.kpiVal, { color: "#d97706" }]}>{parcialCount}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Não Conformes</Text>
            <Text style={[styles.kpiVal, { color: "#dc2626" }]}>{naoConformeCount}</Text>
          </View>
        </View>

        {/* Executive Summary */}
        <Text style={styles.sectionTitle}>Sumário Executivo da Análise</Text>
        <View style={styles.summaryBox}>
          <Text>{result.executive_summary}</Text>
        </View>

        {/* Findings List */}
        <Text style={styles.sectionTitle}>Parecer de Requisitos &amp; Evidências Apuradas</Text>

        {result.findings.map((finding, idx) => {
          const badgeStyle =
            finding.status === "conforme"
              ? styles.badgeConforme
              : finding.status === "parcial"
              ? styles.badgeParcial
              : styles.badgeNaoConforme;

          const badgeText =
            finding.status === "conforme"
              ? "CONFORME"
              : finding.status === "parcial"
              ? "PARCIAL"
              : "NÃO CONFORME";

          return (
            <View key={idx} style={styles.findingCard} wrap={false}>
              <View style={styles.findingHeader}>
                <Text style={styles.findingId}>
                  {finding.requirementId} — {finding.requirementName}
                </Text>
                <Text style={badgeStyle}>{badgeText}</Text>
              </View>
              <Text style={styles.findingText}>
                <Text style={{ fontWeight: "bold" }}>Evidência: </Text>
                {finding.evidence}
              </Text>
              <Text style={styles.findingRec}>
                Recomendação SecOps: {finding.recommendation}
              </Text>
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>CyberITSM SPN · Relatório de Conformidade Registrado com Hash Forense em GZIP</Text>
          <Text>Página 1</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateProjectPdfBuffer(result: QaResult): Promise<Buffer> {
  return await ReactPDF.renderToBuffer(<QaProjectPdfDocument result={result} />);
}
