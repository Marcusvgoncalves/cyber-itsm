'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClientInstance } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Shield, Mail, Lock, User as UserIcon, HelpCircle, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClientInstance();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'analyst' | 'requester'>('requester');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!email || !password) {
      setMessage({ type: 'error', text: 'Por favor, preencha todos os campos obrigatórios.' });
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        // Success - redirect to dashboard (middleware will handle routing)
        router.refresh();
        router.push('/');
      } else {
        // Sign Up
        if (!fullName) {
          setMessage({ type: 'error', text: 'Por favor, insira seu nome completo.' });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          throw error;
        }

        if (data.user && data.session === null) {
          setMessage({
            type: 'success',
            text: 'Cadastro realizado! Por favor, verifique sua caixa de e-mail para confirmar a conta.',
          });
        } else {
          // Automatic login if verification is disabled in Supabase dashboard
          router.refresh();
          router.push('/');
        }
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: 'error',
        text: err.message || 'Ocorreu um erro inesperado durante a autenticação.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden text-slate-100 font-sans">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md p-8 m-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-2xl shadow-2xl transition-all duration-300">
        
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl mb-4 shadow-lg shadow-indigo-600/20">
            <Shield className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-200 bg-clip-text text-transparent">
            CyberITSM Portal
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            IT Service Management focado em Arquitetura de Segurança
          </p>
        </div>

        {/* Custom Tabs */}
        <div className="flex border-b border-slate-800 mb-6 p-0.5 bg-slate-950/40 rounded-lg">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              isLogin ? 'bg-slate-850 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => {
              setIsLogin(true);
              setMessage(null);
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              !isLogin ? 'bg-slate-850 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => {
              setIsLogin(false);
              setMessage(null);
            }}
          >
            Criar Conta
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-start space-x-3 text-sm border ${
              message.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-450'
            }`}
          >
            {message.type === 'error' ? (
              <HelpCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{message.text}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Nome Completo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                  <UserIcon className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Marcus Vinícius"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-500 text-white placeholder-slate-600 transition-all text-sm"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Endereço de E-mail
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: seu-nome@empresa.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-500 text-white placeholder-slate-600 transition-all text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Senha de Acesso
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-500 text-white placeholder-slate-600 transition-all text-sm"
                required
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Papel de Acesso (RBAC)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-500 text-white transition-all text-sm"
              >
                <option value="requester" className="bg-slate-900">Solicitante (Requester)</option>
                <option value="analyst" className="bg-slate-900">Analista de Segurança (Analyst)</option>
                <option value="admin" className="bg-slate-900">Administrador (Admin)</option>
              </select>
              <p className="text-slate-500 text-[11px] mt-1.5 leading-normal">
                * Nota: Papel selecionável apenas para facilidade de avaliação/teste deste protótipo de arquitetura.
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 text-white rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all font-medium text-sm flex items-center justify-center"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : isLogin ? (
              'Entrar no Painel'
            ) : (
              'Concluir Cadastro'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
