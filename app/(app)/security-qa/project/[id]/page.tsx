import { notFound, redirect } from "next/navigation";
import { getQaResultById } from "@/lib/security-qa/qaRepository";
import { getArchivedSignedUrl } from "@/lib/security-qa/storage";
import { getCurrentUser } from "@/lib/supabase";
import { ProjectDashboard } from "@/components/security-qa/project-dashboard";

export const metadata = {
  title: "Dashboard de Avaliação",
  description: "Resultado da análise de segurança do Centro de Security QA",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDashboardPage({ params }: Props) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const result = await getQaResultById(id);
  if (!result) notFound();

  // URL assinada fresca para download da evidência forense arquivada.
  const evidenceUrl = await getArchivedSignedUrl(result.archived_file_path);

  return (
    <ProjectDashboard
      result={result}
      evidenceUrl={evidenceUrl ?? result.archived_file_url}
      currentUser={currentUser}
    />
  );
}
