import { Metadata } from "next"
import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"

export const metadata: Metadata = {
  title: "Login - CyberITSM SPN",
  description: "Acesse a plataforma CyberITSM SPN",
}

function LoginFormWrapper() {
  return <LoginForm />
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="flex items-center justify-center h-64">Carregando...</div>}>
          <LoginFormWrapper />
        </Suspense>
      </div>
    </div>
  )
}