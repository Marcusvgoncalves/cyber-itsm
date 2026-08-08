import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/tickets";
import { getSprints, getNotificationSettings, getCustomRequirements } from "@/app/actions/cadastros";
import { CadastrosClient } from "@/components/admin/cadastros-client";
import type { Sprint, NotificationSetting, SecurityRequirement } from "@/lib/types";

export const metadata = {
  title: "Cadastros - CyberITSM SPN",
  description: "Cadastros de sprints, matriz de requisitos e notificações",
};

export default async function CadastrosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Matriz SoD: somente ADMIN acessa a administração de cadastros.
  if (user.role !== "admin") {
    redirect("/dashboard?auth_error=unauthorized_role");
  }

  let initialSprints: Sprint[] = [];
  let initialNotifications: NotificationSetting[] = [];
  let initialRequirements: SecurityRequirement[] = [];

  try {
    const [sprints, notifications, requirements] = await Promise.all([
      getSprints(),
      getNotificationSettings(),
      getCustomRequirements(),
    ]);
    initialSprints = sprints;
    initialNotifications = notifications;
    initialRequirements = requirements;
  } catch (err) {
    console.error("Erro ao carregar cadastros:", err);
  }

  return (
    <CadastrosClient
      currentUser={user}
      initialSprints={initialSprints}
      initialNotifications={initialNotifications}
      initialRequirements={initialRequirements}
    />
  );
}
