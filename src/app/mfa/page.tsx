'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClientInstance } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Shield, Key, CheckCircle, AlertTriangle, ArrowLeft, RefreshCw, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function MfaPage() {
  const router = useRouter();
  const supabase = createBrowserClientInstance();

  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<any[]>([]);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Enrollment State
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch MFA status
  const loadMfaStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const enrolled = data.all.filter((f) => f.status === 'verified');
      setFactors(data.all);
      setMfaEnabled(enrolled.length > 0);
    } catch (err: any) {
      console.error('Error listing MFA factors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMfaStatus();
  }, []);

  // Initiate MFA Enrollment
  const startEnrollment = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'CyberITSM',
        friendlyName: user.email || 'Admin',
      });

      if (error) throw error;

      setFactorId(data.id);
      // Supabase returns the qr_code as a SVG data URI (data:image/svg+xml;utf-8,...)
      setQrCodeDataUrl(data.totp.qr_code);
      setSecretKey(data.totp.secret);
      setIsEnrolling(true);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Erro ao iniciar ativação de MFA.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Verify and complete MFA enrollment
  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length < 6) {
      setMessage({ type: 'error', text: 'Insira o código de 6 dígitos.' });
      return;
    }

    setActionLoading(true);
    setMessage(null);

    try {
      // 1. Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // 2. Verify challenge
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) throw verifyError;

      setMessage({ type: 'success', text: 'MFA Ativado com sucesso!' });
      setIsEnrolling(false);
      setVerificationCode('');
      await loadMfaStatus();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Código de verificação inválido.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Enrollment Process
  const cancelEnrollment = () => {
    setIsEnrolling(false);
    setQrCodeDataUrl('');
    setSecretKey('');
    setFactorId('');
    setVerificationCode('');
    setMessage(null);
  };

  // Disable MFA (Unenroll)
  const disableMfa = async (id: string) => {
    if (!confirm('Deseja realmente desativar a autenticação multifator (MFA)? Isso reduzirá a segurança da conta.')) {
      return;
    }

    setActionLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;

      setMessage({ type: 'success', text: 'MFA desativado com sucesso.' });
      await loadMfaStatus();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Erro ao desativar o MFA.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-blue-600/5 blur-[130px] pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        
        {/* Back Link */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Dashboard</span>
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Configurações de Segurança</h1>
            <p className="text-slate-400 mt-1">Gere políticas e gerencie a Autenticação de Múltiplos Fatores (MFA)</p>
          </div>
        </div>

        {/* Feedback Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border flex items-start space-x-3 text-sm ${
            message.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            {message.type === 'error' ? <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-slate-400 text-sm">Carregando status de segurança...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* MFA Status Card */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className={`p-2.5 rounded-lg mt-1 ${mfaEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {mfaEnabled ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Autenticação Multifator (MFA)</h2>
                    <p className="text-slate-400 text-sm mt-1 max-w-md leading-relaxed">
                      Adicione uma camada extra de segurança à sua conta exigindo um código gerador de autenticação (TOTP) ao fazer login.
                    </p>
                    <div className="mt-3 flex items-center space-x-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Status:</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        mfaEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {mfaEnabled ? 'Ativado (Forte)' : 'Desativado (Fraco)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {!mfaEnabled && !isEnrolling && (
                    <Button onClick={startEnrollment} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-xl">
                      Configurar MFA
                    </Button>
                  )}
                  {mfaEnabled && (
                    <Button
                      onClick={() => disableMfa(factors[0]?.id)}
                      disabled={actionLoading}
                      variant="outline"
                      className="border-red-500/30 hover:bg-red-500/10 text-red-400 font-medium px-5 py-2.5 rounded-xl"
                    >
                      Desativar MFA
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* MFA Setup Interface */}
            {isEnrolling && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl animate-fade-in space-y-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Key className="w-5 h-5 text-blue-400" />
                    <span>Configurar Autenticador TOTP</span>
                  </h3>
                  <button onClick={cancelEnrollment} className="text-slate-400 hover:text-white transition-colors text-sm font-medium">
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* QR Code Scan */}
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                    {qrCodeDataUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={qrCodeDataUrl} alt="MFA QR Code" className="w-48 h-48 bg-white p-2 rounded-xl" />
                    ) : (
                      <div className="w-48 h-48 bg-slate-900 animate-pulse rounded-xl flex items-center justify-center">
                        <span className="text-slate-600 text-xs">Gerando QR...</span>
                      </div>
                    )}
                    <span className="text-[11px] text-slate-500 mt-3 text-center leading-normal">
                      Escaneie com Google Authenticator, Microsoft Authenticator, Bitwarden ou similar.
                    </span>
                  </div>

                  {/* Activation Form */}
                  <div className="flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <p className="text-sm text-slate-350 leading-relaxed">
                        Se não conseguir escanear o código QR, insira a chave secreta manualmente no seu aplicativo autenticador:
                      </p>
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl select-all font-mono text-xs text-center text-blue-400 break-all">
                        {secretKey || 'carregando chave...'}
                      </div>
                    </div>

                    <form onSubmit={confirmEnrollment} className="space-y-3 pt-4 border-t border-slate-800/65">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Código de Verificação de 6 dígitos
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        pattern="\d{6}"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000 000"
                        className="w-full text-center tracking-[0.7em] text-lg font-mono py-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-500 text-white placeholder-slate-700 transition-all"
                        required
                      />

                      <Button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-medium shadow-lg shadow-blue-600/10 transition-all active:scale-[0.98]"
                      >
                        {actionLoading ? (
                          <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin inline-block" />
                        ) : (
                          'Verificar e Ativar'
                        )}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
