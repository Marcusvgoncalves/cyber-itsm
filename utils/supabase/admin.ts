import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com role de serviço (bypass de RLS).
 * Usado APENAS em Server Actions/Server Components para operações
 * administrativas sensíveis (criação de usuários em auth.users,
 * gerenciamento de contas), que exigem privilegios de admin.
 *
 * Esse client não persiste sessão/cookies: opera somente via service role key,
 * então não deve ser usado (nem importado) em componentes/client.
 *
 * NUNCA use este client em componentes/client para não expor a service role key.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}