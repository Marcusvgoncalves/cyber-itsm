import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

// Simular autenticação SCIM via Token Bearer estático
function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ");
}

function scimError(status: number, detail: string) {
  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    status: status.toString(),
    detail
  }, { status });
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return scimError(401, "Não autorizado. Token SCIM ausente ou inválido.");
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || ""; // Ex.: userName eq "email@test.com"

  try {
    const admin = createAdminClient();

    // Buscar todos os perfis
    let query = admin.from("users_profiles").select("*");
    
    // Se houver filtro básico de e-mail/username
    if (filter) {
      const match = filter.match(/userName\s+eq\s+["']([^"']+)["']/i);
      if (match && match[1]) {
        query = query.eq("email", match[1].trim().toLowerCase());
      }
    }

    const { data: profiles, error: dbError } = await query.order("created_at", { ascending: true });
    if (dbError) throw dbError;

    // Buscar usuários na autenticação para obter o status 'active' real (banned)
    const { data: authUsersData, error: authError } = await admin.auth.admin.listUsers();
    const authUsersMap = new Map(authUsersData?.users.map(u => [u.id, u]) || []);

    const resources = (profiles || []).map(p => {
      const authUser = authUsersMap.get(p.id);
      const isBanned = authUser && authUser.banned_until && new Date(authUser.banned_until) > new Date();
      
      const parts = (p.full_name || "").split(" ");
      const givenName = parts[0] || "";
      const familyName = parts.slice(1).join(" ") || "";

      return {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        id: p.id,
        userName: p.email,
        name: {
          formatted: p.full_name || "",
          familyName,
          givenName
        },
        emails: [
          {
            value: p.email,
            type: "work",
            primary: true
          }
        ],
        active: !isBanned,
        roles: [
          {
            value: p.role,
            display: p.role === "admin" ? "Administrador" : p.role === "analista" ? "Analista" : "Solicitante"
          }
        ],
        meta: {
          resourceType: "User",
          created: p.created_at,
          lastModified: p.updated_at,
          location: `https://cyber-itsm.vercel.app/api/scim/v2/Users/${p.id}`
        }
      };
    });

    return NextResponse.json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: resources.length,
      itemsPerPage: resources.length,
      startIndex: 1,
      Resources: resources
    });
  } catch (err) {
    return scimError(500, err instanceof Error ? err.message : "Erro interno no servidor.");
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return scimError(401, "Não autorizado.");
  }

  try {
    const scimUser = await req.json();
    const emailVal = scimUser.userName?.trim().toLowerCase() || 
                     scimUser.emails?.find((e: any) => e.primary || e.type === "work")?.value?.trim().toLowerCase();
    const nameVal = scimUser.name?.formatted || 
                    `${scimUser.name?.givenName || ""} ${scimUser.name?.familyName || ""}`.trim() || 
                    emailVal.split("@")[0];
    
    const scimRole = scimUser.roles?.[0]?.value || "solicitante";
    const roleVal: "admin" | "analista" | "solicitante" = 
      ["admin", "analista", "solicitante"].includes(scimRole) ? scimRole : "solicitante";

    if (!emailVal) {
      return scimError(400, "Atributo 'userName' (ou email correspondente) é obrigatório.");
    }

    const admin = createAdminClient();

    // 1. Criar usuário no Supabase Auth
    const defaultPassword = "CyberITSM@2026!Password";
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: emailVal,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        full_name: nameVal,
        role: roleVal,
        requires_password_change: true
      },
      app_metadata: {
        role: roleVal
      }
    });

    if (authError) {
      return scimError(409, `Conflito ao criar usuário no Auth: ${authError.message}`);
    }

    if (!authData.user) {
      return scimError(500, "Falha na criação do usuário.");
    }

    // 2. Garantir sincronização na users_profiles
    const userId = authData.user.id;
    const { data: profile, error: dbError } = await admin
      .from("users_profiles")
      .upsert({
        id: userId,
        email: emailVal,
        full_name: nameVal,
        role: roleVal,
        idp_provider: "scim",
        idp_external_id: userId
      })
      .select("*")
      .single();

    if (dbError) {
      return scimError(500, `Erro ao criar perfil de usuário: ${dbError.message}`);
    }

    // Log de auditoria
    await admin.from('audit_logs').insert({
      user_id: userId,
      action: 'scim_user_provision',
      entity_type: 'users_profiles',
      entity_id: userId,
      ip_address: req.headers.get("x-forwarded-for") || "127.0.0.1",
      user_agent: "SCIM Client Integration"
    });

    const parts = nameVal.split(" ");
    const givenName = parts[0] || "";
    const familyName = parts.slice(1).join(" ") || "";

    return NextResponse.json({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: userId,
      userName: emailVal,
      name: {
        formatted: nameVal,
        familyName,
        givenName
      },
      emails: [
        {
          value: emailVal,
          type: "work",
          primary: true
        }
      ],
      active: true,
      roles: [
        {
          value: roleVal,
          display: roleVal === "admin" ? "Administrador" : roleVal === "analista" ? "Analista" : "Solicitante"
        }
      ],
      meta: {
        resourceType: "User",
        created: profile.created_at,
        lastModified: profile.updated_at,
        location: `https://cyber-itsm.vercel.app/api/scim/v2/Users/${userId}`
      }
    }, { status: 201 });
  } catch (err) {
    return scimError(500, err instanceof Error ? err.message : "Erro desconhecido.");
  }
}
