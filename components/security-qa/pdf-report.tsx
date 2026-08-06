"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { QaResult } from "@/lib/security-qa/types";

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a" },
  header: { borderBottom: 2, borderBottomColor: "#660099", paddingBottom: 10, marginBottom: 16 },
  brand: { fontSize: 14, fontWeight: "bold", color: "#660099" },
  title: { fontSize: 18, fontWeight: "bold", marginTop: 4 },
  meta: { fontSize: 9, color: "#737373", marginTop: 3 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", color: "#660099", marginTop: 14, marginBottom: 6 },
  kpiRow: { flexDirection: "row", marginBottom: 10, gap: 8 },
  kpi: { flex: 1, border: 1, borderColor: "#e5e5e5", borderRadius: 4, padding: 8 },
  kpiLabel: { fontSize: 8, color: "#737373", textTransform: "uppercase" },
  kpiValue: { fontSize: 14, fontWeight: "bold", marginTop: 2 },
  text: { lineHeight: 1.5, marginBottom: 6 },
  finding: { marginBottom: 8, borderLeft: 3, borderLeftColor: "#e5e5e5", paddingLeft: 8 },
  findingTitle: { fontWeight: "bold", fontSize: 9.5 },
  status: { fontSize: 8, fontWeight: "bold", marginTop: 1 },
  evidence: { fontSize: 8.5, color: "#444444", marginTop: 3, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#9ca3af", borderTop: 1, borderTopColor: "#e5e5e5", paddingTop: 6 },
});

const STATUS_LABEL: Record<string, string> = {
  conforme: "Conforme",
  parcial: "Parcial",
  nao_conforme: "Não conforme",
};

const STATUS_COLOR: Record<string, string> = {
  conforme: "#1a9e5c",
  parcial: "#FF9900",
  nao_conforme: "#ef4444",
};

export function QaReportDocument({ result }: { result: QaResult }) {
  const ratingLabel: Record<string, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico" };

  return (
    <Document
      title={`Relatório de Security QA - ${result.project_name}`}
      author="CyberITSM SPN"
      subject="Sumário executivo de avaliação de segurança"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Centro de Security QA · CyberITSM SPN</Text>
          <Text style={styles.title}>Relatório Executivo de Segurança</Text>
          <Text style={styles.meta}>
            Projeto: {result.project_name} · Ambiente: {result.environment_url}
          </Text>
          <Text style={styles.meta}>
            Data: {new Date(result.created_at).toLocaleString("pt-BR")} · ID: {result.id}
          </Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Conformidade</Text>
            <Text style={styles.kpiValue}>{Number(result.compliance_percent).toFixed(1)}%</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Classificação de Risco</Text>
            <Text style={styles.kpiValue}>{ratingLabel[result.overall_rating] ?? result.overall_rating}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Requisitos Avaliados</Text>
            <Text style={styles.kpiValue}>{result.findings.length}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Compressão GZIP</Text>
            <Text style={styles.kpiValue}>
              {result.compression_ratio != null ? `${(result.compression_ratio * 100).toFixed(0)}%` : "N/A"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Sumário Executivo</Text>
        <Text style={styles.text}>{result.executive_summary}</Text>

        <Text style={styles.sectionTitle}>Análise por Requisito ({result.findings.length})</Text>
        {result.findings.map((f, i) => (
          <View key={`${f.requirementId}-${i}`} style={styles.finding}>
            <Text style={styles.findingTitle}>
              [{f.requirementId}] {f.requirementName}
            </Text>
            <Text style={[styles.status, { color: STATUS_COLOR[f.status] }]}>
              {STATUS_LABEL[f.status] ?? f.status}
            </Text>
            <Text style={styles.evidence}>Evidência: {f.evidence}</Text>
            <Text style={styles.evidence}>Recomendação: {f.recommendation}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Evidência Forense Arquivada</Text>
        <Text style={styles.text}>
          Arquivo original: {result.original_file_name} ({result.original_size_bytes} bytes) · Arquivo arquivado:
          {result.archived_file_path} ({result.archived_size_bytes} bytes, GZIP).
        </Text>

        <View style={styles.footer}>
          <Text>
            Documento gerado automaticamente pelo Centro de Security QA. A evidência comprimida (GZIP) é mantida no bucket
            qa-logs-archive para preservação forense.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
