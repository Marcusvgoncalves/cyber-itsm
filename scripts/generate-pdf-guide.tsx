import React from "react";
import ReactPDF, { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

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
  coverPage: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#660099",
    color: "#ffffff",
    height: "100%",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#660099",
    paddingBottom: 8,
    marginBottom: 16,
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
    fontSize: 22,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 11,
    color: "#475569",
    marginBottom: 16,
    lineHeight: 1.4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#660099",
    marginTop: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#660099",
    paddingLeft: 6,
  },
  paragraph: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: "#334155",
    marginBottom: 8,
  },
  box: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  boxTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  bulletList: {
    marginLeft: 8,
    marginBottom: 8,
  },
  bulletItem: {
    fontSize: 9,
    lineHeight: 1.4,
    color: "#334155",
    marginBottom: 3,
  },
  bold: {
    fontWeight: "bold",
    color: "#0f172a",
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
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    marginBottom: 10,
    overflow: "hidden",
  },
  tableHeader: {
    backgroundColor: "#660099",
    flexDirection: "row",
    padding: 6,
  },
  tableHeaderCell: {
    color: "#ffffff",
    fontSize: 8.5,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: 6,
  },
  tableCell: {
    fontSize: 8.5,
    color: "#334155",
  },
});

export function ManualPdfDocument() {
  return (
    <Document title="Guia de Uso Oficial — CyberITSM SPN" author="CyberITSM SPN Team">
      {/* Capa */}
      <Page size="A4" style={styles.coverPage}>
        <View>
          <Text style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.8 }}>
            Manual Técnico &amp; Operacional
          </Text>
          <Text style={{ fontSize: 28, fontWeight: "bold", marginTop: 12, marginBottom: 8 }}>
            CyberITSM SPN
          </Text>
          <Text style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.4, maxWidth: 450 }}>
            Plataforma Corporativa de Cibersegurança, Governança de Identidade (IAM/IGA), Esteira DevSecOps Multiagente &amp; RAG dos 314 Requisitos SD v4.1
          </Text>
        </View>

        <View style={{ backgroundColor: "rgba(255, 255, 255, 0.12)", padding: 16, borderRadius: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>Recursos Cobertos neste Guia:</Text>
          <Text style={{ fontSize: 9.5, lineHeight: 1.5, opacity: 0.95 }}>
            • Gestão Operacional via Quadro Kanban &amp; Dashboard de Criticidade{"\n"}
            • Autenticação Segura com MFA TOTP Obrigatório (RFC 6238) &amp; Sessão Reativa{"\n"}
            • Copiloto de IA Global Multiagente (Groq, OpenRouter &amp; Google Gemini){"\n"}
            • Centro de Security QA com Análise Autônoma &amp; Compressão GZIP Forense{"\n"}
            • Catálogo Interativo dos 314 Requisitos Segura SD v4.1{"\n"}
            • Governança de Identidade com SCIM v2.0, SAML 2.0 &amp; SSO
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", paddingTop: 12 }}>
          <Text style={{ fontSize: 9, opacity: 0.8 }}>Versão 2.4 (Edição 2026)</Text>
          <Text style={{ fontSize: 9, opacity: 0.8 }}>CyberITSM · Cibersegurança Corporativa</Text>
        </View>
      </Page>

      {/* Página 1: Visão Geral & Arquitetura */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CyberITSM SPN · Guia de Uso</Text>
          <Text style={styles.headerSub}>Capítulo 1: Visão Geral &amp; Segurança da Sessão</Text>
        </View>

        <Text style={styles.title}>1. Visão Geral da Solução</Text>
        <Text style={styles.paragraph}>
          O <Text style={styles.bold}>CyberITSM SPN</Text> é uma plataforma corporativa de IT Service Management (ITSM) especializada em Cibersegurança e Conformidade Regulatória. Projetada sobre o Next.js 16 App Router, React 19 e Supabase PostgreSQL, a aplicação combina governança operacional de vulnerabilidades com inteligência artificial generativa de alta resiliência.
        </Text>

        <Text style={styles.sectionTitle}>1.1 Política de Sessão &amp; Autenticação MFA</Text>
        <View style={styles.box}>
          <Text style={styles.boxTitle}>Requisitos de Acesso &amp; Ciclo de Vida da Sessão</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Formato de Credenciais:</Text> Acesso via nome de usuário corporativo (<Text style={styles.bold}>nome.sobrenome</Text>) e senha forte (mínimo 12 caracteres com letras, números e símbolos).
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>MFA/TOTP Obrigatório:</Text> Nenhuma conta acessa a plataforma sem verificação de segundo fator (RFC 6238 via Google Authenticator / Microsoft Authenticator).
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Sessão Reativa (1h / 15m):</Text> A sessão ativa expira em até <Text style={styles.bold}>1 hora de uso contínuo</Text>. Quando inativa, o sistema realiza o encerramento automático em <Text style={styles.bold}>15 minutos de inatividade</Text> (idle timeout).
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Preservação de Histórico:</Text> As conversas com o Copiloto de IA permanecem salvas localmente no navegador (<Text style={styles.bold}>localStorage</Text>) por usuário, mantendo o histórico intacto após o logoff.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>1.2 Visão Geral da Arquitetura de Módulos</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: "30%" }]}>Módulo</Text>
            <Text style={[styles.tableHeaderCell, { width: "70%" }]}>Descrição Funcional</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "30%", fontWeight: "bold" }]}>Quadro Kanban</Text>
            <Text style={[styles.tableCell, { width: "70%" }]}>Gestão visual do fluxo de chamados de mitigação por status (Aberto, Em Andamento, Revisão, Fechado).</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "30%", fontWeight: "bold" }]}>Kanban Dashboard</Text>
            <Text style={[styles.tableCell, { width: "70%" }]}>Métricas volumétricas gráficos Recharts, probabilidade de SLA e calculadora interativa de criticidade.</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "30%", fontWeight: "bold" }]}>Portal IAM / IGA</Text>
            <Text style={[styles.tableCell, { width: "70%" }]}>Sincronização Entra ID/Keycloak, API SCIM v2.0, SAML 2.0 SSO e solicitações de acesso Just-In-Time.</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "30%", fontWeight: "bold" }]}>Centro Security QA</Text>
            <Text style={[styles.tableCell, { width: "70%" }]}>Ingestão de relatórios brutos, validação autônoma contra a matriz SD v4.1, GZIP Forensics e exportação PDF.</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "30%", fontWeight: "bold" }]}>Base de Conhecimento</Text>
            <Text style={[styles.tableCell, { width: "70%" }]}>Catálogo interativo dos 314 Requisitos Segura SD v4.1 com busca, filtros por criticidade e guias PDF.</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>CyberITSM SPN · Guia de Uso da Plataforma</Text>
          <Text>Página 1 de 4</Text>
        </View>
      </Page>

      {/* Página 2: Operação do Kanban & Copiloto IA */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CyberITSM SPN · Guia de Uso</Text>
          <Text style={styles.headerSub}>Capítulo 2: Kanban, Dashboard &amp; Copiloto IA Multiagente</Text>
        </View>

        <Text style={styles.title}>2. Operação de Chamados &amp; Copiloto de IA</Text>

        <Text style={styles.sectionTitle}>2.1 Quadro Kanban &amp; Dashboard Interativo</Text>
        <Text style={styles.paragraph}>
          No painel principal (<Text style={styles.bold}>/dashboard</Text>), o analista gerencia todas as pendências de cibersegurança. Clique no botão <Text style={styles.bold}>"Dashboard"</Text> no topo do Kanban para alternar para a visão de inteligência volumétrica.
        </Text>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Funcionalidades do Dashboard Kanban</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Métricas Volumétricas:</Text> Indicadores de chamados Abertos, Críticos, Em Andamento e Cumprimento de SLA.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Calculadora de Criticidade:</Text> Ferramenta integrada baseada em probabilidade e impacto para determinar automaticamente se o chamado é Baixo, Médio, Alto ou Crítico.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Previsão de Atendimento:</Text> Projeção analítica de prazos de resolução com base no histórico de tratamento da equipe.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>2.2 Copiloto de IA Multiagente (Zero Downtime)</Text>
        <Text style={styles.paragraph}>
          O assistente de IA está disponível em qualquer página da plataforma através da bolha flutuante (FAB) no canto inferior direito. Ele utiliza um mecanismo de <Text style={styles.bold}>Roteamento Multiagente de 3 Camadas</Text> focado no uso gratuito sem interrupções:
        </Text>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Esteira de Resiliência de IA (Fallback Encadeado)</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              1. <Text style={styles.bold}>Groq Engine (Llama 3.1 8B / 3.3 70B):</Text> Resposta ultra-rápida de altíssima prioridade (latência &lt; 2s).
            </Text>
            <Text style={styles.bulletItem}>
              2. <Text style={styles.bold}>OpenRouter (DeepSeek R1 / Chat):</Text> Agente secundário para raciocínio profundo e modelagem de ameaças.
            </Text>
            <Text style={styles.bulletItem}>
              3. <Text style={styles.bold}>Google Gemini (2.0 Flash / 2.0 Flash-Lite):</Text> Backup de alta capacidade de contexto e RAG sobre os 314 requisitos.
            </Text>
          </View>
        </View>
        <Text style={styles.paragraph}>
          Se um provedor atingir o limite de requisições (<Text style={styles.bold}>HTTP 429 - RESOURCE_EXHAUSTED</Text>), o roteador chaveia automaticamente para o próximo agente em milissegundos sem falhar a requisição do usuário.
        </Text>

        <View style={styles.footer}>
          <Text>CyberITSM SPN · Guia de Uso da Plataforma</Text>
          <Text>Página 2 de 4</Text>
        </View>
      </Page>

      {/* Página 3: Centro de Security QA & Catálogo 314 Requisitos */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CyberITSM SPN · Guia de Uso</Text>
          <Text style={styles.headerSub}>Capítulo 3: Security QA &amp; Catálogo de Requisitos</Text>
        </View>

        <Text style={styles.title}>3. Centro de Security QA &amp; Requisitos</Text>

        <Text style={styles.sectionTitle}>3.1 Motor de Avaliação Autônoma de Evidências</Text>
        <Text style={styles.paragraph}>
          O módulo <Text style={styles.bold}>Security QA</Text> (<Text style={styles.bold}>/security-qa</Text>) permite submeter relatórios brutos de varredura (JSON, XML ou TXT) para auditoria automática contra a matriz de segurança.
        </Text>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Passo a Passo de Execução no Security QA</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              1. Clique em <Text style={styles.bold}>"Nova Avaliação"</Text> e informe o Nome do Projeto e URL do Ambiente.
            </Text>
            <Text style={styles.bulletItem}>
              2. Selecione os Requisitos de Arquitetura aplicáveis do escopo (ex.: CYBER.SEGURA.APIS.*).
            </Text>
            <Text style={styles.bulletItem}>
              3. Faça o upload do arquivo de evidência (.json, .xml ou .txt com até 5MB).
            </Text>
            <Text style={styles.bulletItem}>
              4. O motor dispara o pipeline em tempo real: <Text style={styles.bold}>download -&gt; análise multiagente -&gt; compressão GZIP -&gt; expurgo do arquivo temporário</Text>.
            </Text>
            <Text style={styles.bulletItem}>
              5. O laudo final apresenta o percentual de conformidade %, rating de risco e opções de <Text style={styles.bold}>Download de Relatório Executivo em PDF</Text>.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>3.2 Catálogo Interativo dos 314 Requisitos (SD v4.1)</Text>
        <Text style={styles.paragraph}>
          Na aba <Text style={styles.bold}>Base de Conhecimento</Text> (<Text style={styles.bold}>/knowledge-base</Text>), a plataforma disponibiliza o acervo completo de 314 requisitos de segurança de desenvolvimento e arquitetura.
        </Text>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Recursos de Consulta do Catálogo</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Busca Instantânea:</Text> Localize requisitos por ID, controle, OWASP, vetores STRIDE ou palavras-chave.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Filtros por Criticidade:</Text> Separe instantaneamente requisitos Críticos, Altos, Moderados e Baixos.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Fichas de Validação:</Text> Expanda qualquer item para visualizar a evidência exigida e os scripts/procedimentos de teste.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>CyberITSM SPN · Guia de Uso da Plataforma</Text>
          <Text>Página 3 de 4</Text>
        </View>
      </Page>

      {/* Página 4: Governança IAM / IGA & Conclusão */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CyberITSM SPN · Guia de Uso</Text>
          <Text style={styles.headerSub}>Capítulo 4: Governança IAM/IGA &amp; Arquitetura</Text>
        </View>

        <Text style={styles.title}>4. Portal IAM / IGA &amp; Conectores</Text>

        <Text style={styles.sectionTitle}>4.1 Provisionamento SCIM v2.0 &amp; SSO SAML 2.0</Text>
        <Text style={styles.paragraph}>
          O módulo <Text style={styles.bold}>Portal IAM/IGA</Text> entrega recursos avançados de governança corporativa de identidades:
        </Text>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Capacidades de Integração de Identidades</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>API SCIM v2.0 (/api/scim/v2/Users):</Text> Suporte nativo ao padrão internacional de ciclo de vida de usuários para integração com Azure Entra ID e Okta.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>SAML 2.0 SSO (/api/saml/sso &amp; metadata):</Text> Endpoints prontos para Single Sign-On federado corporativo.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Fila de Aprovação Sailpoint IGA:</Text> Solicitação de acessos temporários Just-In-Time (JIT) com fluxo de aprovação por analistas SecOps.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.bold}>Gestão Local de Usuários:</Text> Criação de usuários no Supabase Auth com forçamento de reconfiguração de MFA, troca de papéis (RBAC) e desativação instantânea.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>4.2 Suporte &amp; Boas Práticas Operacionais</Text>
        <Text style={styles.paragraph}>
          Para garantir o uso ideal do CyberITSM SPN, siga as recomendações abaixo:
        </Text>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Checklist Operacional SecOps</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              1. Sempre vincule novo chamados a um <Text style={styles.bold}>Framework de Origem</Text> (NIST, CIS, OWASP).
            </Text>
            <Text style={styles.bulletItem}>
              2. Ao interagir com o Copiloto de IA, mencione o ID do chamado ou selecione o ticket para injeção automática de contexto.
            </Text>
            <Text style={styles.bulletItem}>
              3. Mantenha o aplicativo autenticador MFA sempre sincronizado. Em caso de perda, solicite o reset via Admin no Portal IAM.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 20, padding: 12, backgroundColor: "#660099", borderRadius: 6, color: "#ffffff" }}>
          <Text style={{ fontSize: 11, fontWeight: "bold", marginBottom: 4 }}>CyberITSM SPN — Segurança, Governança &amp; Inteligência</Text>
          <Text style={{ fontSize: 8.5, opacity: 0.9 }}>
            Documentação gerada sob demanda. Dúvidas técnicas ou solicitações de novos conectores podem ser encaminhadas à equipe de Arquitetura de Cibersegurança.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>CyberITSM SPN · Guia de Uso da Plataforma</Text>
          <Text>Página 4 de 4</Text>
        </View>
      </Page>
    </Document>
  );
}

async function main() {
  const outputPath = path.join(process.cwd(), "public", "docs", "guia-uso.pdf");
  console.log(`Gerando PDF do Guia de Uso em: ${outputPath}...`);

  await ReactPDF.renderToFile(<ManualPdfDocument />, outputPath);
  console.log("PDF do Guia de Uso gerado com sucesso!");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Erro ao gerar PDF:", err);
    process.exit(1);
  });
}
