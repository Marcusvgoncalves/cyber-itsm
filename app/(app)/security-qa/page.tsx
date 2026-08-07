import { listQaResults } from "@/lib/security-qa/qaRepository";
import { SecurityQaClient } from "./security-qa-client";

export const metadata = {
  title: "Centro de Security QA",
  description: "Ingestão de relatórios de segurança, cruzamento com requisitos via IA e arquivamento forense",
};

export default async function SecurityQaHomePage() {
  const results = await listQaResults(50).catch(() => []);

  return <SecurityQaClient initialResults={results} />;
}
