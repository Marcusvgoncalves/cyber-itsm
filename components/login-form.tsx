"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/utils/supabase/client"
import { Loader2, AlertCircle, Mail, Lock, Eye, EyeOff, ShieldCheck, KeyRound, ArrowLeft } from "lucide-react"
import { initiateMfa, confirmMfaSetup, verifyMfa, requestPasswordReset } from "@/app/actions/auth"

type LoginStep = 'CREDENTIALS' | 'MFA_ONBOARDING' | 'MFA_VERIFICATION';

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/dashboard"
  
  const [step, setStep] = useState<LoginStep>('CREDENTIALS')
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // MFA States
  const [mfaSecret, setMfaSecret] = useState("")
  const [qrCodeUri, setQrCodeUri] = useState("")
  const [mfaCode, setMfaCode] = useState("")
  
  // Password Reset sandbox helper
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null)

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const rawInput = email.trim().toLowerCase()
    const formattedEmail = rawInput.includes('@')
      ? rawInput.replace(/@(telefonica\.com|vivo\.com\.br|.*)$/, '@cyberitsm.local')
      : `${rawInput}@cyberitsm.local`

    // 1. Authenticate with Supabase Auth
    const supabase = createClient()
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: formattedEmail,
      password,
    })

    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' 
        ? 'Credenciais inválidas. Verifique seu e-mail e senha.' 
        : signInError.message)
      setIsLoading(false)
      return
    }

    const user = signInData.user
    if (!user) {
      setError("Usuário não encontrado.")
      setIsLoading(false)
      return
    }

    // 2. Fetch User Profile
    const { data: profile, error: profileError } = await supabase
      .from('users_profiles')
      .select('mfa_setup_complete, mfa_secret')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      setError("Erro ao carregar perfil de segurança.")
      setIsLoading(false)
      return
    }

    // 3. Handle MFA Steps
    if (!profile.mfa_setup_complete) {
      // User must configure MFA (First access / Onboarding)
      try {
        const { secret, qrCodeUri: uri } = await initiateMfa()
        setMfaSecret(secret)
        setQrCodeUri(uri)
        setStep('MFA_ONBOARDING')
      } catch (err: any) {
        setError(err.message || "Erro ao inicializar MFA.")
      }
    } else {
      // User already has MFA configured, must verify
      setStep('MFA_VERIFICATION')
    }
    
    setIsLoading(false)
  }

  const handleMfaOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const successSetup = await confirmMfaSetup(mfaSecret, mfaCode)
      if (successSetup) {
        setSuccess("MFA ativado com sucesso! Carregando painel...")
        setTimeout(() => {
          router.push(redirectTo)
          router.refresh()
        }, 1000)
      } else {
        setError("Código do MFA inválido. Tente novamente ou use 123456.")
      }
    } catch (err: any) {
      setError(err.message || "Erro ao confirmar MFA.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleMfaVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const verified = await verifyMfa(mfaCode)
      if (verified) {
        setSuccess("MFA validado com sucesso! Carregando painel...")
        setTimeout(() => {
          router.push(redirectTo)
          router.refresh()
        }, 1000)
      } else {
        setError("Código do MFA incorreto. Tente novamente ou use o código de testes 123456.")
      }
    } catch (err: any) {
      setError(err.message || "Erro ao verificar MFA.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError("Digite seu e-mail para recuperar a senha")
      return
    }

    setIsLoading(true)
    setError(null)
    setRecoveryLink(null)

    try {
      const response = await requestPasswordReset(email)
      if (response.success && response.link) {
        setSuccess("E-mail de recuperação gerado!")
        setRecoveryLink(response.link)
      } else {
        setError(response.error || "Erro ao solicitar recuperação.")
      }
    } catch (err: any) {
      setError(err.message || "Erro na solicitação de redefinição.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md bg-white border border-gray-200 shadow-xl overflow-hidden relative rounded-xl">
      {/* Vivo Accent Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-vivo" />
      
      <CardHeader className="text-center pt-8 pb-4">
        <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900 tracking-tight">CyberITSM SPN</CardTitle>
        <CardDescription className="text-muted-foreground font-medium">
          Plataforma de IT Service Management
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20 animate-fadeIn">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2.5 text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200 animate-fadeIn">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            <div className="flex-1">
              <span className="font-semibold">{success}</span>
              {recoveryLink && (
                <div className="mt-2 p-2 bg-white rounded border border-green-100">
                  <p className="text-xs text-gray-500 font-mono mb-1">Link de Recuperação (Sandbox):</p>
                  <a href={recoveryLink} className="text-xs text-primary hover:underline font-bold break-all">
                    Redefinir Senha
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'CREDENTIALS' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Usuário (nome.sobrenome)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="text"
                  placeholder="marcus.goncalves"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 border-gray-300 focus:border-primary focus:ring-primary rounded-md"
                  required
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Senha</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-semibold text-primary hover:text-primary-hover hover:underline transition-colors"
                >
                  Esqueci a senha
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 border-gray-300 focus:border-primary focus:ring-primary rounded-md"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 italic">Dica padrão: joao.secops / CyberITSM@2026!Password</p>
            </div>

            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-medium shadow-md transition-all duration-200" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        )}

        {step === 'MFA_ONBOARDING' && (
          <form onSubmit={handleMfaOnboardingSubmit} className="space-y-4 animate-fadeIn">
            <div className="text-center space-y-2">
              <KeyRound className="h-8 w-8 text-vivo mx-auto animate-pulse" />
              <h3 className="font-semibold text-gray-900 text-lg">Configurar MFA</h3>
              <p className="text-xs text-gray-600 max-w-xs mx-auto">
                Escaneie o QR Code abaixo com seu aplicativo autenticador (Google Authenticator) ou digite a chave secreta manualmente.
              </p>
            </div>

            {/* Real Dynamic QR Code Rendering */}
            <div className="flex flex-col items-center justify-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUri || `otpauth://totp/CyberITSM?secret=${mfaSecret}&issuer=CyberITSM`)}`}
                alt="QR Code MFA"
                className="w-36 h-36 bg-white p-2 border border-gray-300 rounded shadow-sm"
              />
              <div className="mt-2.5 text-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Chave Secreta</span>
                <code className="text-sm font-mono text-primary font-bold tracking-widest">{mfaSecret}</code>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mfaCode" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Código de 6 dígitos</Label>
              <Input
                id="mfaCode"
                type="text"
                maxLength={6}
                placeholder="000 000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="h-11 border-gray-300 focus:border-primary focus:ring-primary text-center font-bold tracking-widest text-lg"
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="w-1/3" onClick={() => setStep('CREDENTIALS')} disabled={isLoading}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium shadow-md transition-all duration-200" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ativar e Entrar
              </Button>
            </div>
          </form>
        )}

        {step === 'MFA_VERIFICATION' && (
          <form onSubmit={handleMfaVerificationSubmit} className="space-y-4 animate-fadeIn">
            <div className="text-center space-y-2">
              <KeyRound className="h-8 w-8 text-primary mx-auto animate-pulse" />
              <h3 className="font-semibold text-gray-900 text-lg">Validação de Identidade (MFA)</h3>
              <p className="text-xs text-gray-600 max-w-xs mx-auto">
                Insira o código gerado no aplicativo autenticador do seu celular.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mfaCode" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Código MFA de 6 dígitos</Label>
              <Input
                id="mfaCode"
                type="text"
                maxLength={6}
                placeholder="000 000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="h-11 border-gray-300 focus:border-primary focus:ring-primary text-center font-bold tracking-widest text-lg"
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="w-1/3" onClick={() => setStep('CREDENTIALS')} disabled={isLoading}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium shadow-md transition-all duration-200" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verificar
              </Button>
            </div>
          </form>
        )}

        {step === 'CREDENTIALS' && (
          <>
            <Separator>Ou</Separator>

            <form onSubmit={handleForgotPassword} className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                Esqueceu a senha? Solicite uma nova chave
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="digite-seu-usuario (ex.: marcus.goncalves)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-10 border-gray-300 focus:border-primary focus:ring-primary rounded-md"
                  required
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
              <Button type="submit" variant="outline" className="w-full border-gray-300 hover:bg-gray-50 text-gray-700" disabled={isLoading}>
                Solicitar nova senha
              </Button>
            </form>
          </>
        )}
      </CardContent>
      <CardFooter className="pb-8 pt-4 flex flex-col gap-2">
        <p className="text-xs text-center text-muted-foreground">
          CyberITSM SPN &copy; 2026 - Cyber Security Platform
        </p>
      </CardFooter>
    </Card>
  )
}