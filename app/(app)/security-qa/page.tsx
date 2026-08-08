import { listQaResults } from "@/lib/security-qa/qaRepository";
import { getCurrentUser } from "@/lib/supabase";
import { SecurityQaClient } from "./security-qa-client";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Centro de Security QA",
  description: "Ingestão de relatórios de segurança, cruzamento com requisitos via IA e arquivamento forense",
};

export default async function SecurityQaHomePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const results = await listQaResults(50).catch(() => []);

  return <SecurityQaClient initialResults={results} currentUser={currentUser} />;
}
