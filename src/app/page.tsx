'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Shield, Key, LogOut, User as UserIcon, ShieldAlert, Award, FileText, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm font-medium">Autenticando sessão...</p>
        </div>
      </div>
    );
  }

  // Fallback in case user is not loaded yet (though middleware protects this)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Redirecionando...</p>
      </div>
    );
  }

  // Format roles into display badges
  const roleColors: Record<string, string> = {
    admin: 'bg-red-500/10 text-red-400 border border-red-500/20',
    analyst: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    requester: 'bg-emerald-500/10 text-emerald-455 border border-emerald-500/20',
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrador (Admin)',
    analyst: 'Analista de Cibersegurança',
    requester: 'Solicitante (Requester)',
  };

  const currentRole = profile?.role || 'requester';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* Background design accents */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">CyberITSM</span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-450 font-medium">Sessão Segura</span>
          </div>

          <Button
            onClick={signOut}
            variant="outline"
            className="border-slate-850 hover:bg-slate-900 text-slate-300 px-3 py-1.5 h-auto text-xs rounded-lg flex items-center space-x-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </Button>
        </div>
      </header>

      {/* Main content grid */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto p-6 md:p-12 flex flex-col justify-center space-y-8">
        
        {/* Welcome Section */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 md:p-8 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-2xl text-slate-400">
              <UserIcon className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Autenticado</span>
              <h2 className="text-2xl font-bold text-white mt-1">
                Olá, {profile?.full_name || user.email?.split('@')[0]}
              </h2>
              <p className="text-slate-400 text-sm mt-1">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center space-x-2 ${roleColors[currentRole]}`}>
              <ShieldAlert className="w-4 h-4" />
              <span>{roleLabels[currentRole]}</span>
            </div>
          </div>
        </div>

        {/* Security Controls & Core Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Multi-Factor Authentication Control Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between space-y-4">
            <div>
              <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl w-fit text-blue-400 mb-4">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Múltiplos Fatores (MFA)</h3>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Proteja a sua conta com autenticação multifator utilizando aplicativos de senha baseada em tempo (TOTP). Isso é obrigatório para analistas e administradores de segurança.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-850">
              <Link href="/mfa">
                <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-xl text-sm">
                  Configurar MFA
                </Button>
              </Link>
            </div>
          </div>

          {/* Next Phase Preview Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between space-y-4">
            <div>
              <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl w-fit text-indigo-400 mb-4">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Módulo Core ITSM</h3>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                A infraestrutura de banco de dados e autenticação está 100% pronta. O próximo passo (Fase 3) criará o Dashboard de chamados no estilo Jira com o framework de cibersegurança integrado.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-850 flex items-center space-x-2.5 text-xs text-slate-400 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Infraestrutura e Autenticação Validadas</span>
            </div>
          </div>
        </div>

        {/* Technical Architecture Info */}
        <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 flex items-start space-x-3 text-xs text-slate-450 leading-normal">
          <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold text-slate-300">Resumo da Arquitetura Atual:</span> O sistema está integrado com o Supabase Auth (via <code className="text-blue-300">@supabase/ssr</code>). As rotas de navegação são protegidas em tempo de execução via <code className="text-blue-300">src/middleware.ts</code> no Next.js. O banco de dados possui gatilhos de criação de profiles de RBAC e auditoria.
          </div>
        </div>

      </main>
    </div>
  );
}
