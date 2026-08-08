import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Let static assets and authentication endpoints bypass
  if (
    path.startsWith('/_next') ||
    path.startsWith('/favicon.ico') ||
    path.startsWith('/images') ||
    path.startsWith('/api/auth') ||
    path === '/login' ||
    path === '/reset-password'
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Se as variáveis de ambiente ainda não foram configuradas na Vercel, permite navegação segura sem 404/crash
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // Session activity & inactivity management (1 hour max total, 15 mins inactivity)
  if (user) {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const fifteenMinutesMs = 15 * 60 * 1000;

    const sessionStartCookie = request.cookies.get('session_start')?.value;
    const lastActivityCookie = request.cookies.get('last_activity')?.value;

    let sessionStart = sessionStartCookie ? parseInt(sessionStartCookie, 10) : null;
    let lastActivity = lastActivityCookie ? parseInt(lastActivityCookie, 10) : null;

    if (!sessionStart) {
      sessionStart = now;
      response.cookies.set('session_start', now.toString(), {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    if (!lastActivity) {
      lastActivity = now;
      response.cookies.set('last_activity', now.toString(), {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    const timeSinceStart = now - sessionStart;
    const timeSinceLastActivity = now - lastActivity;

    if (timeSinceStart > oneHourMs || timeSinceLastActivity > fifteenMinutesMs) {
      console.log(`[Session Timeout] Logoff automático: total ${timeSinceStart}ms, inatividade ${timeSinceLastActivity}ms`);
      
      await supabase.auth.signOut();

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('redirect', path);
      redirectUrl.searchParams.set('session_expired', 'true');

      const logoutResponse = NextResponse.redirect(redirectUrl);
      logoutResponse.cookies.delete('mfa_verified');
      logoutResponse.cookies.delete('session_start');
      logoutResponse.cookies.delete('last_activity');
      
      const supabaseCookies = request.cookies.getAll();
      for (const cookie of supabaseCookies) {
        if (cookie.name.startsWith('sb-')) {
          logoutResponse.cookies.delete(cookie.name);
        }
      }

      return logoutResponse;
    }

    // Refresh last activity to extend the 15-minute inactivity window
    response.cookies.set('last_activity', now.toString(), {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  // If trying to access dashboard routes and not logged in
  if ((path.startsWith('/dashboard') || path.startsWith('/admin')) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(redirectUrl);
  }

  // If logged in, perform MFA and RBAC checks
  if (user && (path.startsWith('/dashboard') || path.startsWith('/admin'))) {
    try {
      // Get user profile role and MFA status
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('role, mfa_setup_complete')
        .eq('id', user.id)
        .single();

      if (profile) {
        // 1. MFA enforcement
        const mfaVerified = request.cookies.get('mfa_verified')?.value === 'true';
        if (!mfaVerified) {
          // Redirect to login to verify or setup MFA code
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/login';
          return NextResponse.redirect(redirectUrl);
        }

        // 2. RBAC check for architecture (Admin-only)
        // Check if path is architecture or if we are requesting admin-only segments
        if (path.includes('/architecture') || path.includes('/reports') || path.includes('/audit') || path.startsWith('/admin')) {
          if (profile.role !== 'admin') {
            // Redirect unauthorized profiles to dashboard index
            const redirectUrl = request.nextUrl.clone();
            redirectUrl.pathname = '/dashboard';
            redirectUrl.searchParams.set('auth_error', 'unauthorized_role');
            return NextResponse.redirect(redirectUrl);
          }
        }
      }
    } catch (err) {
      console.error('Erro no middleware de segurança:', err);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
