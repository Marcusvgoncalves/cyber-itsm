"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ShieldAlert, CheckCircle2, Lock, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { resetPasswordWithToken } from "@/app/actions/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Password requirements state
  const [reqs, setReqs] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false,
    match: false,
  });

  useEffect(() => {
    setReqs({
      length: password.length >= 12,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      match: password.length > 0 && password === confirmPassword,
    });
  }, [password, confirmPassword]);

  const isValid = Object.values(reqs).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Token de recuperação ausente ou inválido.");
      return;
    }

    if (!isValid) {
      setError("A senha não atende a todos os requisitos de segurança obrigatórios.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await resetPasswordWithToken(token, password);
      if (response.success) {
        setSuccess("Senha redefinida com sucesso! Redirecionando para o login...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setError(response.error || "Erro ao redefinir a senha.");
      }
    } catch (err: any) {
      setError(err.message || "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <Card className="w-full max-w-md bg-white border border-gray-200 shadow-xl overflow-hidden relative rounded-xl">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-destructive" />
        <CardHeader className="text-center pt-8">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">Erro de Token</CardTitle>
          <CardDescription className="text-muted-foreground font-medium mt-1">
            Nenhum token de recuperação válido foi encontrado na URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-8 pt-4">
          <Button onClick={() => router.push("/login")} className="w-full bg-primary hover:bg-primary-hover text-white">
            Voltar para o Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md bg-white border border-gray-200 shadow-xl overflow-hidden relative rounded-xl">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-vivo" />
      
      <CardHeader className="text-center pt-8 pb-4">
        <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-3">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold text-gray-900 tracking-tight">Nova Senha Forte</CardTitle>
        <CardDescription className="text-muted-foreground font-medium">
          Crie uma nova credencial corporativa estrita
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20 animate-fadeIn">
            <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2.5 text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200 animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova Senha</Label>
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
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10 h-11 border-gray-300 focus:border-primary focus:ring-primary rounded-md"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Requirements visual indicator */}
          <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg space-y-2 text-xs">
            <p className="font-semibold text-gray-700 uppercase tracking-wider text-[10px]">Políticas de Segurança Necessárias:</p>
            <div className="grid grid-cols-1 gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${reqs.length ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={reqs.length ? 'text-green-700 font-medium' : 'text-gray-600'}>Mínimo de 12 caracteres</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${reqs.upper ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={reqs.upper ? 'text-green-700 font-medium' : 'text-gray-600'}>Pelo menos uma letra maiúscula</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${reqs.lower ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={reqs.lower ? 'text-green-700 font-medium' : 'text-gray-600'}>Pelo menos uma letra minúscula</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${reqs.number ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={reqs.number ? 'text-green-700 font-medium' : 'text-gray-600'}>Pelo menos um número</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${reqs.special ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={reqs.special ? 'text-green-700 font-medium' : 'text-gray-600'}>Pelo menos um caractere especial (!@#$...)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${reqs.match ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={reqs.match ? 'text-green-700 font-medium' : 'text-gray-600'}>Confirmação idêntica à senha inserida</span>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-medium shadow-md transition-all duration-200" disabled={isLoading || !isValid}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Redefinir e Salvar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <Suspense fallback={<div className="flex items-center justify-center h-64 text-white">Carregando...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
