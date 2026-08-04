"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { SecurityAgent } from "@/components/SecurityAgent";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { 
  LogOut, Shield, Users, TicketCheck, Settings, Database, 
  RefreshCw, CheckCircle, XCircle, ArrowUpRight, ShieldAlert,
  KeyRound, Lock, QrCode
} from "lucide-react";
import { logoutUser, changeUserPassword, disableMfa, initiateMfa, confirmMfaSetup } from "@/app/actions/auth";
import { syncIamProvider, createIdentityRequest, approveIdentityRequest, rejectIdentityRequest, createLocalUser } from "@/app/actions/iam";
import type { Status, Ticket, IamProvider, IamUser, IdentityRequest, User, AuditLog } from "@/lib/types";

interface DashboardClientProps {
  currentUser: User;
  initialStatuses: Status[];
  initialTickets: Ticket[];
  initialIamProviders: IamProvider[];
  initialIamUsers: IamUser[];
  initialIdentityRequests: IdentityRequest[];
  initialAuditLogs: AuditLog[];
  systemUsers: User[];
}

export function DashboardClient({
  currentUser,
  initialStatuses,
  initialTickets,
  initialIamProviders,
  initialIamUsers,
  initialIdentityRequests,
  initialAuditLogs,
  systemUsers,
}: DashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'kanban' | 'iam' | 'audit' | 'architecture' | 'settings'>('kanban');
  const [isPending, startTransition] = useTransition();

  // Local state for reloading lists after actions
  const [iamUsers, setIamUsers] = useState<IamUser[]>(initialIamUsers);
  const [identityRequests, setIdentityRequests] = useState<IdentityRequest[]>(initialIdentityRequests);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);
  const [statuses, setStatuses] = useState<Status[]>(initialStatuses);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);

  // Security Agent state
  const [showAgent, setShowAgent] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Forms states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // Sailpoint form states
  const [reqEmail, setReqEmail] = useState("");
  const [reqRole, setReqRole] = useState<'admin' | 'analista' | 'solicitante'>('solicitante');
  const [reqJustification, setReqJustification] = useState("");
  const [reqSuccess, setReqSuccess] = useState<string | null>(null);

  // Local user form states
  const [localEmail, setLocalEmail] = useState("");
  const [localFullName, setLocalFullName] = useState("");
  const [localRole, setLocalRole] = useState<'admin' | 'analista' | 'solicitante'>('solicitante');
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  // In-tab MFA setup states
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null);

  const handleLogout = async () => {
    await logoutUser();
    router.push("/login");
    router.refresh();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (newPassword.length < 12) {
      setPwdError("A senha deve conter pelo menos 12 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("As senhas não coincidem.");
      return;
    }

    const success = await changeUserPassword(newPassword);
    if (success) {
      setPwdSuccess("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPwdError("Erro ao alterar senha.");
    }
  };

  // Sync Provider (Entra ID or Keycloak)
  const handleSyncProvider = async (providerId: string) => {
    startTransition(async () => {
      try {
        await syncIamProvider(providerId);
        // Reload sync users & logs
        const { getIamUsers, getIdentityRequests } = await import("@/app/actions/iam");
        const { getAuditLogs } = await import("@/app/actions/tickets");
        const [updatedUsers, updatedRequests, updatedLogs] = await Promise.all([
          getIamUsers(),
          getIdentityRequests(),
          getAuditLogs(100),
        ]);
        setIamUsers(updatedUsers);
        setIdentityRequests(updatedRequests);
        setAuditLogs(updatedLogs);
      } catch (err) {
        console.error("Erro ao sincronizar provedor:", err);
      }
    });
  };

  // Create Identity Request (Sailpoint)
  const handleRequestRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqSuccess(null);
    try {
      await createIdentityRequest({
        provider_id: 'sailpoint',
        target_user_email: reqEmail,
        requested_role: reqRole,
        justification: reqJustification,
      });
      setReqSuccess("Requisição enviada ao gestor SecOps via Sailpoint!");
      setReqEmail("");
      setReqJustification("");
      
      const { getIdentityRequests } = await import("@/app/actions/iam");
      const updatedRequests = await getIdentityRequests();
      setIdentityRequests(updatedRequests);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Approve request
  const handleApproveRequest = async (requestId: string) => {
    startTransition(async () => {
      try {
        await approveIdentityRequest(requestId);
        const { getIdentityRequests } = await import("@/app/actions/iam");
        const { getAuditLogs } = await import("@/app/actions/tickets");
        const [updatedRequests, updatedLogs] = await Promise.all([
          getIdentityRequests(),
          getAuditLogs(100),
        ]);
        setIdentityRequests(updatedRequests);
        setAuditLogs(updatedLogs);
      } catch (err: any) {
        console.error(err);
      }
    });
  };

  // Reject request
  const handleRejectRequest = async (requestId: string) => {
    startTransition(async () => {
      try {
        await rejectIdentityRequest(requestId);
        const { getIdentityRequests } = await import("@/app/actions/iam");
        const updatedRequests = await getIdentityRequests();
        setIdentityRequests(updatedRequests);
      } catch (err: any) {
        console.error(err);
      }
    });
  };

  // Create Local user
  const handleCreateLocalUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalSuccess(null);
    try {
      await createLocalUser({
        email: localEmail,
        full_name: localFullName,
        role: localRole,
      });
      setLocalSuccess("Usuário local cadastrado com sucesso!");
      setLocalEmail("");
      setLocalFullName("");
      
      const { getAuditLogs } = await import("@/app/actions/tickets");
      const updatedLogs = await getAuditLogs(100);
      setAuditLogs(updatedLogs);
    } catch (err: any) {
      console.error(err);
    }
  };

  // MFA Controls inside Settings
  const handleToggleMfa = async () => {
    if (currentUser.mfa_setup_complete) {
      // Disable
      startTransition(async () => {
        await disableMfa();
        currentUser.mfa_setup_complete = false;
        currentUser.mfa_secret = null;
        router.refresh();
      });
    } else {
      // Initiate setup
      setIsSettingUpMfa(true);
      const { secret } = await initiateMfa();
      setMfaSecret(secret);
    }
  };

  const handleConfirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError(null);
    setMfaSuccess(null);

    const verified = await confirmMfaSetup(mfaSecret, mfaCode);
    if (verified) {
      setMfaSuccess("MFA ativado com sucesso!");
      currentUser.mfa_setup_complete = true;
      currentUser.mfa_secret = mfaSecret;
      setTimeout(() => {
        setIsSettingUpMfa(false);
        setMfaCode("");
        router.refresh();
      }, 1500);
    } else {
      setMfaError("Código de ativação inválido. Tente 123456.");
    }
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold tracking-tight text-gray-900">CyberITSM <span className="text-vivo">SPN</span></span>
              </div>
              
              <nav className="hidden md:flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('kanban')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'kanban' 
                      ? 'bg-primary-light text-primary' 
                      : 'text-gray-600 hover:text-primary hover:bg-gray-50'
                  }`}
                >
                  Quadro Kanban
                </button>
                <button
                  onClick={() => setActiveTab('iam')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'iam' 
                      ? 'bg-primary-light text-primary' 
                      : 'text-gray-600 hover:text-primary hover:bg-gray-50'
                  }`}
                >
                  Portal IAM / IGA
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setActiveTab('audit')}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'audit' 
                          ? 'bg-primary-light text-primary' 
                          : 'text-gray-600 hover:text-primary hover:bg-gray-50'
                      }`}
                    >
                      Audit Logs
                    </button>
                    <button
                      onClick={() => setActiveTab('architecture')}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'architecture' 
                          ? 'bg-primary-light text-primary' 
                          : 'text-gray-600 hover:text-primary hover:bg-gray-50'
                      }`}
                    >
                      Arquitetura C4
                    </button>
                  </>
                )}
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'settings' 
                      ? 'bg-primary-light text-primary' 
                      : 'text-gray-600 hover:text-primary hover:bg-gray-50'
                  }`}
                >
                  Configurações
                </button>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-bold text-gray-900">{currentUser.full_name || currentUser.email}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  {currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'analista' ? 'Analista' : 'Solicitante'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-sm border border-gray-100">
                {currentUser.full_name?.substring(0, 2).toUpperCase() || currentUser.email.substring(0, 2).toUpperCase()}
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-primary">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'kanban' && (
          <div className="h-[calc(100vh-170px)]">
            <KanbanBoard
              initialStatuses={statuses}
              initialTickets={tickets}
              currentUser={currentUser}
              onTicketSelect={(ticket) => setSelectedTicket(ticket)}
            />
          </div>
        )}

        {activeTab === 'iam' && (
          <div className="space-y-6">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Portal de Governança de Identidades (IAM / IGA)</h2>
              <p className="text-gray-600 text-sm mt-1">Gerencie integrações de identidades com os provedores corporativos de mercado.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Active integrations */}
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Provedores de Identidade Integrados</CardTitle>
                    <CardDescription>Sincronize credenciais corporativas no sandbox local</CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y divide-gray-150">
                    <div className="flex items-center justify-between py-4">
                      <div>
                        <h4 className="font-bold text-gray-900">Microsoft Entra ID (OIDC)</h4>
                        <p className="text-xs text-gray-500">Mapeamento de claims e escopos OIDC corporativos</p>
                      </div>
                      <Button size="sm" onClick={() => handleSyncProvider('entra_id')} disabled={isPending} className="bg-primary hover:bg-primary-hover gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
                      </Button>
                    </div>
                    <div className="flex items-center justify-between py-4">
                      <div>
                        <h4 className="font-bold text-gray-900">Keycloak Broker</h4>
                        <p className="text-xs text-gray-500">Mapeamento de Realms e Client Credentials</p>
                      </div>
                      <Button size="sm" onClick={() => handleSyncProvider('keycloak')} disabled={isPending} className="bg-primary hover:bg-primary-hover gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
                      </Button>
                    </div>
                    <div className="flex items-center justify-between py-4 opacity-75">
                      <div>
                        <h4 className="font-bold text-gray-900">Oracle Access Manager (OAM WebGate)</h4>
                        <p className="text-xs text-gray-500">SSO legado baseado em injeção de headers HTTP</p>
                      </div>
                      <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded">Passivo</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Synced Users List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Usuários Sincronizados de IAM</CardTitle>
                    <CardDescription>Visualização de identidades mapeadas via OIDC e Brokers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 font-bold">
                          <tr>
                            <th scope="col" className="px-4 py-3">Nome</th>
                            <th scope="col" className="px-4 py-3">E-mail</th>
                            <th scope="col" className="px-4 py-3">Provedor</th>
                            <th scope="col" className="px-4 py-3">Departamento</th>
                            <th scope="col" className="px-4 py-3">Função Mapeada</th>
                            <th scope="col" className="px-4 py-3">Último Sync</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {iamUsers.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-gray-400">
                                Nenhum usuário sincronizado. Clique em "Sincronizar" nos provedores acima.
                              </td>
                            </tr>
                          ) : (
                            iamUsers.map((usr) => (
                              <tr key={usr.id} className="bg-white hover:bg-gray-50">
                                <td className="px-4 py-3 font-semibold text-gray-950">{usr.full_name}</td>
                                <td className="px-4 py-3 font-mono text-xs">{usr.email}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    usr.provider_id === 'entra_id' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                                  }`}>
                                    {usr.provider_id === 'entra_id' ? 'Microsoft Entra ID' : 'Keycloak'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs">{usr.department}</td>
                                <td className="px-4 py-3 font-semibold uppercase text-xs">{usr.role}</td>
                                <td className="px-4 py-3 text-xs">
                                  {new Date(usr.last_sync!).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sailpoint Approval flow */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Solicitar Função (Sailpoint IGA)</CardTitle>
                    <CardDescription>Workflow formal de governança com aprovação de SecOps</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {reqSuccess && (
                      <div className="mb-4 text-xs bg-green-50 text-green-700 border border-green-200 p-2.5 rounded">
                        {reqSuccess}
                      </div>
                    )}
                    <form onSubmit={handleRequestRole} className="space-y-3">
                      <div>
                        <Label htmlFor="reqEmail" className="text-xs font-semibold">E-mail do Colaborador</Label>
                        <Input
                          id="reqEmail"
                          type="email"
                          placeholder="email@telefonica.com"
                          value={reqEmail}
                          onChange={(e) => setReqEmail(e.target.value)}
                          required
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reqRole" className="text-xs font-semibold">Função Pretendida</Label>
                        <Select value={reqRole} onValueChange={(v: any) => setReqRole(v)}>
                          <SelectTrigger id="reqRole" className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="solicitante">Solicitante (Básico)</SelectItem>
                            <SelectItem value="analista">Analista (Criar/Editar)</SelectItem>
                            <SelectItem value="admin">Administrador (Total)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="reqJustification" className="text-xs font-semibold">Justificativa Corporativa</Label>
                        <Input
                          id="reqJustification"
                          type="text"
                          placeholder="Motivo do acesso..."
                          value={reqJustification}
                          onChange={(e) => setReqJustification(e.target.value)}
                          required
                          className="h-9 text-sm"
                        />
                      </div>
                      <Button type="submit" className="w-full bg-vivo hover:bg-vivo-hover text-white text-xs h-9">
                        Enviar Requisição IGA
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Local manually creation (Admin only) */}
                {isAdmin && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-bold">Cadastrar Usuário Local</CardTitle>
                      <CardDescription>Criação direta de contas no banco de dados</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {localSuccess && (
                        <div className="mb-4 text-xs bg-green-50 text-green-700 border border-green-200 p-2.5 rounded">
                          {localSuccess}
                        </div>
                      )}
                      <form onSubmit={handleCreateLocalUser} className="space-y-3">
                        <div>
                          <Label htmlFor="localName" className="text-xs font-semibold">Nome Completo</Label>
                          <Input
                            id="localName"
                            type="text"
                            placeholder="João SecOps"
                            value={localFullName}
                            onChange={(e) => setLocalFullName(e.target.value)}
                            required
                            className="h-9 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="localEmail" className="text-xs font-semibold">E-mail</Label>
                          <Input
                            id="localEmail"
                            type="email"
                            placeholder="email@telefonica.com"
                            value={localEmail}
                            onChange={(e) => setLocalEmail(e.target.value)}
                            required
                            className="h-9 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="localRole" className="text-xs font-semibold">Perfil RBAC</Label>
                          <Select value={localRole} onValueChange={(v: any) => setLocalRole(v)}>
                            <SelectTrigger id="localRole" className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="solicitante">Solicitante</SelectItem>
                              <SelectItem value="analista">Analista</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-xs h-9">
                          Criar Perfil
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Sailpoint Requests Approval queue */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold">Fila de Aprovação de Acesso (Sailpoint IGA)</CardTitle>
                <CardDescription>Fluxo formal de governança SecOps para autorização de perfis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 font-bold">
                      <tr>
                        <th scope="col" className="px-4 py-3">Solicitante</th>
                        <th scope="col" className="px-4 py-3">E-mail Alvo</th>
                        <th scope="col" className="px-4 py-3">Perfil Requerido</th>
                        <th scope="col" className="px-4 py-3">Justificativa</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                        <th scope="col" className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {identityRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-gray-400">
                            Nenhuma requisição de acesso pendente no Sailpoint.
                          </td>
                        </tr>
                      ) : (
                        identityRequests.map((req) => (
                          <tr key={req.id} className="bg-white hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold text-gray-900">{req.requester?.full_name || req.requester?.email || 'N/A'}</td>
                            <td className="px-4 py-3 font-mono text-xs">{req.target_user_email}</td>
                            <td className="px-4 py-3 uppercase font-semibold text-xs text-primary">{req.requested_role}</td>
                            <td className="px-4 py-3 text-xs">{req.justification}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                req.status === 'provisionado' ? 'bg-green-50 text-green-700 border border-green-200' :
                                req.status === 'pendente' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                                {req.status === 'provisionado' ? 'Aprovado & Provisionado' : req.status === 'pendente' ? 'Aprovação Pendente' : 'Rejeitado'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {req.status === 'pendente' && isAdmin ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button size="sm" onClick={() => handleApproveRequest(req.id)} className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-2 py-1 h-7">
                                    Aprovar
                                  </Button>
                                  <Button size="sm" onClick={() => handleRejectRequest(req.id)} variant="destructive" className="text-[10px] px-2 py-1 h-7">
                                    Rejeitar
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Nenhuma ação</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'audit' && isAdmin && (
          <div className="space-y-6">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Logs de Auditoria do Sistema (SecOps)</h2>
              <p className="text-gray-600 text-sm mt-1">Rastreabilidade completa de ações e transações de segurança realizadas na plataforma.</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold">Histórico de Eventos Auditados</CardTitle>
                <CardDescription>Trilha imutável de eventos (criação, edição de chamados e autenticações)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 font-bold text-gray-950">
                      <tr>
                        <th scope="col" className="px-4 py-3">Timestamp</th>
                        <th scope="col" className="px-4 py-3">Usuário</th>
                        <th scope="col" className="px-4 py-3">Ação</th>
                        <th scope="col" className="px-4 py-3">Entidade</th>
                        <th scope="col" className="px-4 py-3">ID Referência</th>
                        <th scope="col" className="px-4 py-3">Metadados / Alterações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-gray-400">
                            Nenhum registro de auditoria gravado.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="bg-white hover:bg-gray-50 font-sans text-xs">
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleDateString('pt-BR', { 
                                day: '2-digit', month: '2-digit', year: 'numeric', 
                                hour: '2-digit', minute: '2-digit', second: '2-digit' 
                              })}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                              {log.user?.full_name || log.user?.email || 'Sistema'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-250">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-semibold">{log.entity_type}</td>
                            <td className="px-4 py-3 font-mono text-[10px] text-gray-400">
                              {log.entity_id ? `...${log.entity_id.slice(-8)}` : 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              {log.new_data ? (
                                <details className="cursor-pointer">
                                  <summary className="text-[10px] text-primary font-bold hover:underline select-none">Ver detalhes</summary>
                                  <pre className="mt-1 p-2 bg-gray-50 border border-gray-100 text-[10px] font-mono rounded max-w-xs overflow-auto">
                                    {JSON.stringify(log.new_data, null, 2)}
                                  </pre>
                                </details>
                              ) : (
                                <span className="text-gray-400 italic">Sem metadados</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'architecture' && isAdmin && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Desenho de Arquitetura C4 (Nível 2 e Nível 3)</h2>
              <p className="text-gray-600 text-sm mt-1">Mapeamento conceitual do ecossistema de segurança do CyberITSM SPN.</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold">Mapeamento Visual de Contêineres e Integrações</CardTitle>
                <CardDescription>Diagrama unificado das camadas Next.js + Supabase e Provedores IAM</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6">
                <ArchitectureDiagram />

                <div className="prose prose-sm max-w-none text-gray-600 space-y-4">
                  <h4 className="text-md font-bold text-gray-950">Componentes Técnicos Reconstruídos:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg">
                      <span className="font-bold text-gray-900 block mb-1">Frontend Client UI</span>
                      <p className="text-xs text-gray-600">
                        Interface rica construída sob o design system **Mistica** da Telefônica.
                        Utiliza Tailwind CSS v4 para estilização leve e responsiva, com a tipografia premium Outfit do Google Fonts.
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg">
                      <span className="font-bold text-gray-900 block mb-1">Server Actions & API Middleware</span>
                      <p className="text-xs text-gray-600">
                        Next.js Server Actions atuando como controladores de rotas e processadores de regras de negócio de cibersegurança.
                        Intercepta requisições via middleware para aplicar regras de RBAC e sessão de forma rígida.
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg">
                      <span className="font-bold text-gray-900 block mb-1">Supabase PostgreSQL</span>
                      <p className="text-xs text-gray-600">
                        Banco de dados corporativo escalável com criptografia e Row Level Security (RLS) aplicados diretamente
                        nas tabelas de chamados e logs de auditoria SecOps.
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg">
                      <span className="font-bold text-gray-900 block mb-1">Simulador IAM / IGA</span>
                      <p className="text-xs text-gray-600">
                        Módulos integrados que simulam sincronizações com Microsoft Entra ID e Keycloak,
                        e controle formal de solicitações de acesso via Sailpoint IdentityNow.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Configurações de Segurança</h2>
              <p className="text-gray-600 text-sm mt-1">Gerencie suas credenciais corporativas e autenticação multi-fator.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* MFA management */}
              <Card className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${currentUser.mfa_setup_complete ? 'bg-green-500' : 'bg-orange-500'}`} />
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    Autenticação Multi-Fator (MFA / TOTP)
                  </CardTitle>
                  <CardDescription>
                    Proteção de segundo fator compatível com o Google Authenticator
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentUser.mfa_setup_complete ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="font-bold">MFA Ativado & Configurado</p>
                          <p className="text-xs text-green-600 mt-0.5">Sua conta está protegida com dupla camada de segurança.</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Se desativar o MFA, sua conta estará mais exposta a riscos de credenciais. O sistema exigirá configuração novamente no próximo login.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 text-sm p-3 rounded-lg">
                        <ShieldAlert className="h-5 w-5 text-orange-600 flex-shrink-0" />
                        <div>
                          <p className="font-bold">MFA Desativado</p>
                          <p className="text-xs text-orange-600 mt-0.5">Ative a autenticação de dois fatores para proteger sua conta.</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        O processo de configuração gerará um QR Code e uma chave secreta para sincronização com seu celular.
                      </p>
                    </div>
                  )}

                  {/* In-tab MFA Onboarding flow */}
                  {isSettingUpMfa && (
                    <div className="p-4 bg-gray-50 border border-gray-250 rounded-lg space-y-4 animate-fadeIn">
                      {mfaError && (
                        <div className="text-xs bg-red-50 text-red-700 border border-red-200 p-2 rounded">
                          {mfaError}
                        </div>
                      )}
                      {mfaSuccess && (
                        <div className="text-xs bg-green-50 text-green-700 border border-green-200 p-2 rounded">
                          {mfaSuccess}
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Sincronize com seu aplicativo:</p>
                        <svg viewBox="0 0 100 100" className="w-28 h-28 bg-white p-1 border border-gray-300 rounded mx-auto">
                          <rect x="0" y="0" width="22" height="22" fill="black" />
                          <rect x="4" y="4" width="14" height="14" fill="white" />
                          <rect x="7" y="7" width="8" height="8" fill="black" />
                          
                          <rect x="78" y="0" width="22" height="22" fill="black" />
                          <rect x="82" y="4" width="14" height="14" fill="white" />
                          <rect x="85" y="7" width="8" height="8" fill="black" />
                          
                          <rect x="0" y="78" width="22" height="22" fill="black" />
                          <rect x="4" y="82" width="14" height="14" fill="white" />
                          <rect x="7" y="85" width="8" height="8" fill="black" />

                          <rect x="38" y="38" width="24" height="24" fill="black" />
                          <rect x="42" y="42" width="16" height="16" fill="white" />
                          <rect x="46" y="46" width="8" height="8" fill="black" />

                          <rect x="28" y="6" width="6" height="12" fill="black" />
                          <rect x="36" y="16" width="12" height="6" fill="black" />
                          <rect x="62" y="10" width="6" height="18" fill="black" />
                          <rect x="6" y="36" width="12" height="6" fill="black" />
                          <rect x="16" y="46" width="6" height="18" fill="black" />
                          <rect x="36" y="72" width="18" height="6" fill="black" />
                          <rect x="72" y="36" width="6" height="12" fill="black" />
                          <rect x="86" y="46" width="8" height="6" fill="black" />
                          <rect x="56" y="86" width="16" height="6" fill="black" />
                          <rect x="82" y="78" width="6" height="16" fill="black" />
                        </svg>
                        <div className="mt-2">
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Chave Secreta</span>
                          <code className="text-xs font-mono font-bold text-primary tracking-widest">{mfaSecret}</code>
                        </div>
                      </div>
                      <form onSubmit={handleConfirmMfa} className="space-y-2">
                        <Label htmlFor="mfaSetupCode" className="text-xs font-semibold text-gray-700">Digite o código de 6 dígitos para ativar:</Label>
                        <Input
                          id="mfaSetupCode"
                          type="text"
                          maxLength={6}
                          placeholder="000000"
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                          className="h-10 text-center font-bold tracking-widest"
                          required
                        />
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="w-1/2" onClick={() => setIsSettingUpMfa(false)}>Cancelar</Button>
                          <Button type="submit" size="sm" className="w-1/2 bg-primary hover:bg-primary-hover text-white">Ativar</Button>
                        </div>
                      </form>
                    </div>
                  )}

                  {!isSettingUpMfa && (
                    <Button 
                      onClick={handleToggleMfa} 
                      disabled={isPending}
                      className={`w-full font-medium ${currentUser.mfa_setup_complete ? 'bg-destructive hover:bg-destructive-hover text-white' : 'bg-primary hover:bg-primary-hover text-white'}`}
                    >
                      {currentUser.mfa_setup_complete ? 'Desativar MFA' : 'Ativar MFA'}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Password Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    Alterar Senha de Acesso
                  </CardTitle>
                  <CardDescription>
                    Atualize sua senha corporativa seguindo políticas fortes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pwdError && (
                    <div className="mb-4 text-xs bg-red-50 text-red-700 border border-red-200 p-2.5 rounded">
                      {pwdError}
                    </div>
                  )}
                  {pwdSuccess && (
                    <div className="mb-4 text-xs bg-green-50 text-green-700 border border-green-200 p-2.5 rounded">
                      {pwdSuccess}
                    </div>
                  )}
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Nova Senha Forte</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="••••••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="h-10"
                      />
                    </div>
                    <Button type="submit" className="w-full h-10 bg-primary hover:bg-primary-hover text-white font-medium">
                      Atualizar Senha
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
</main>
       <SecurityAgent
         ticketData={{
           id: selectedTicket?.id,
           title: selectedTicket?.title,
           description: selectedTicket?.description,
           framework_origem: selectedTicket?.framework_origem,
           dominio_framework: selectedTicket?.dominio_framework,
           priority: selectedTicket?.priority,
           tags: selectedTicket?.tags,
         }}
         isOpen={showAgent}
         onClose={() => setShowAgent(false)}
       />
     </div>
  );
}
