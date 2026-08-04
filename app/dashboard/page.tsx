import { getStatuses, getTickets, getUsers, getCurrentUser, getAuditLogs } from "@/lib/supabase";
import { getIamProviders, getIamUsers, getIdentityRequests } from "@/app/actions/iam";
import { DashboardClient } from "./dashboard-client";
import { redirect } from "next/navigation";
import type { Status, Ticket, IamProvider, IamUser, IdentityRequest, AuditLog, User } from "@/lib/types";

export const metadata = {
  title: "Dashboard - CyberITSM SPN",
  description: "Painel de controle unificado e quadro Kanban",
};

export default async function DashboardPage() {
  // Fetch logged in user profile
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    redirect("/login");
  }

  // Fetch initial data for the dashboard
  let initialStatuses: Status[] = [];
  let initialTickets: Ticket[] = [];
  let initialIamProviders: IamProvider[] = [];
  let initialIamUsers: IamUser[] = [];
  let initialIdentityRequests: IdentityRequest[] = [];
  let initialAuditLogs: AuditLog[] = [];
  let systemUsers: User[] = [];

  try {
    const [
      statuses,
      tickets,
      providers,
      iamUsers,
      requests,
      logs,
      users
    ] = await Promise.all([
      getStatuses(),
      getTickets(),
      getIamProviders(),
      getIamUsers(),
      getIdentityRequests(),
      getAuditLogs(100),
      getUsers()
    ]);

    initialStatuses = statuses;
    initialTickets = tickets;
    initialIamProviders = providers;
    initialIamUsers = iamUsers;
    initialIdentityRequests = requests;
    initialAuditLogs = logs;
    systemUsers = users;
  } catch (err) {
    console.error("Erro ao carregar dados do dashboard no servidor:", err);
    // Continue with empty arrays; the client will handle displaying a fallback warning or error.
  }

  return (
    <DashboardClient
      currentUser={currentUser}
      initialStatuses={initialStatuses}
      initialTickets={initialTickets}
      initialIamProviders={initialIamProviders}
      initialIamUsers={initialIamUsers}
      initialIdentityRequests={initialIdentityRequests}
      initialAuditLogs={initialAuditLogs}
      systemUsers={systemUsers}
    />
  );
}