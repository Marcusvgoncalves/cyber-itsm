import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) {
    return scimError(401, "Não autorizado.");
  }

  const { id } = await params;

  try {
    const admin = createAdminClient();

    // Buscar perfil
    const { data: profile, error: dbError } = await admin
      .from("users_profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (dbError || !profile) {
      return scimError(404, "Usuário não encontrado.");
    }

    // Buscar status active real no auth.users
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(id);
    const isBanned = authUser?.user && authUser.user.banned_until && new Date(authUser.user.banned_until) > new Date();

    const parts = (profile.full_name || "").split(" ");
    const givenName = parts[0] || "";
    const familyName = parts.slice(1).join(" ") || "";

    return NextResponse.json({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: profile.id,
      userName: profile.email,
      name: {
        formatted: profile.full_name || "",
        familyName,
        givenName
      },
      emails: [
        {
          value: profile.email,
          type: "work",
          primary: true
        }
      ],
      active: !isBanned,
      roles: [
        {
          value: profile.role,
          display: profile.role === "admin" ? "Administrador" : profile.role === "analista" ? "Analista" : "Solicitante"
        }
      ],
      meta: {
        resourceType: "User",
        created: profile.created_at,
        lastModified: profile.updated_at,
        location: `https://cyber-itsm.vercel.app/api/scim/v2/Users/${profile.id}`
      }
    });
  } catch (err) {
    return scimError(500, err instanceof Error ? err.message : "Erro interno.");
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) {
    return scimError(401, "Não autorizado.");
  }

  const { id } = await params;

  try {
    const scimUser = await req.json();
    const nameVal = scimUser.name?.formatted || 
                    `${scimUser.name?.givenName || ""} ${scimUser.name?.familyName || ""}`.trim();
    const scimRole = scimUser.roles?.[0]?.value || "solicitante";
    const roleVal: "admin" | "analista" | "solicitante" = 
      ["admin", "analista", "solicitante"].includes(scimRole) ? scimRole : "solicitante";
    const activeVal = scimUser.active !== false;

    const admin = createAdminClient();

    // 1. Atualizar o Supabase Auth (metadata, role, ban status)
    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      user_metadata: {
        full_name: nameVal,
        role: roleVal
      },
      app_metadata: {
        role: roleVal
      },
      ban_duration: activeVal ? "none" : "876000h"
    });

    if (authError) {
      return scimError(500, `Erro ao atualizar usuário no Auth: ${authError.message}`);
    }

    // 2. Atualizar perfil de usuário
    const { data: profile, error: dbError } = await admin
      .from("users_profiles")
      .update({
        full_name: nameVal,
        role: roleVal
      })
      .eq("id", id)
      .select("*")
      .single();

    if (dbError || !profile) {
      return scimError(500, "Erro ao atualizar dados do perfil de usuário.");
    }

    // Gravar log de auditoria
    await admin.from('audit_logs').insert({
      user_id: id,
      action: 'scim_user_update_put',
      entity_type: 'users_profiles',
      entity_id: id,
      ip_address: req.headers.get("x-forwarded-for") || "127.0.0.1",
      user_agent: "SCIM Client Integration"
    });

    const parts = nameVal.split(" ");
    const givenName = parts[0] || "";
    const familyName = parts.slice(1).join(" ") || "";

    return NextResponse.json({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: profile.id,
      userName: profile.email,
      name: {
        formatted: nameVal,
        familyName,
        givenName
      },
      emails: [
        {
          value: profile.email,
          type: "work",
          primary: true
        }
      ],
      active: activeVal,
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
        location: `https://cyber-itsm.vercel.app/api/scim/v2/Users/${profile.id}`
      }
    });
  } catch (err) {
    return scimError(500, err instanceof Error ? err.message : "Erro desconhecido.");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) {
    return scimError(401, "Não autorizado.");
  }

  const { id } = await params;

  try {
    const patchBody = await req.json();
    const operations = patchBody.Operations || [];
    let activeVal: boolean | undefined;
    let nameVal: string | undefined;
    let roleVal: "admin" | "analista" | "solicitante" | undefined;

    // Processar operações de patch SCIM
    for (const op of operations) {
      if (op.op?.toLowerCase() === "replace" || op.op?.toLowerCase() === "add") {
        if (op.path === "active") {
          activeVal = op.value === true || op.value === "true";
        } else if (op.path === "name.formatted") {
          nameVal = op.value;
        } else if (op.path === "roles") {
          const r = op.value?.[0]?.value || op.value;
          if (["admin", "analista", "solicitante"].includes(r)) {
            roleVal = r;
          }
        } else if (!op.path && typeof op.value === "object") {
          if (op.value.active !== undefined) {
            activeVal = op.value.active === true || op.value.active === "true";
          }
          if (op.value.name?.formatted !== undefined) {
            nameVal = op.value.name.formatted;
          }
        }
      }
    }

    const admin = createAdminClient();
    const updateData: Record<string, any> = {};

    if (activeVal !== undefined) {
      await admin.auth.admin.updateUserById(id, {
        ban_duration: activeVal ? "none" : "876000h"
      });
    }

    if (nameVal !== undefined) {
      updateData.full_name = nameVal;
      await admin.auth.admin.updateUserById(id, {
        user_metadata: { full_name: nameVal }
      });
    }

    if (roleVal !== undefined) {
      updateData.role = roleVal;
      await admin.auth.admin.updateUserById(id, {
        app_metadata: { role: roleVal }
      });
    }

    let profile: any;
    if (Object.keys(updateData).length > 0) {
      const { data, error } = await admin
        .from("users_profiles")
        .update(updateData)
        .eq("id", id)
        .select("*")
        .single();
      
      if (error) throw error;
      profile = data;
    } else {
      const { data } = await admin.from("users_profiles").select("*").eq("id", id).single();
      profile = data;
    }

    const parts = (profile.full_name || "").split(" ");
    const givenName = parts[0] || "";
    const familyName = parts.slice(1).join(" ") || "";

    // Buscar status active real no auth.users
    const { data: authUser } = await admin.auth.admin.getUserById(id);
    const isBanned = authUser?.user && authUser.user.banned_until && new Date(authUser.user.banned_until) > new Date();

    // Gravar log de auditoria
    await admin.from('audit_logs').insert({
      user_id: id,
      action: 'scim_user_update_patch',
      entity_type: 'users_profiles',
      entity_id: id,
      ip_address: req.headers.get("x-forwarded-for") || "127.0.0.1",
      user_agent: "SCIM Client Integration"
    });

    return NextResponse.json({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: profile.id,
      userName: profile.email,
      name: {
        formatted: profile.full_name || "",
        familyName,
        givenName
      },
      emails: [
        {
          value: profile.email,
          type: "work",
          primary: true
        }
      ],
      active: !isBanned,
      roles: [
        {
          value: profile.role,
          display: profile.role === "admin" ? "Administrador" : profile.role === "analista" ? "Analista" : "Solicitante"
        }
      ],
      meta: {
        resourceType: "User",
        created: profile.created_at,
        lastModified: profile.updated_at,
        location: `https://cyber-itsm.vercel.app/api/scim/v2/Users/${profile.id}`
      }
    });
  } catch (err) {
    return scimError(500, err instanceof Error ? err.message : "Erro desconhecido.");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) {
    return scimError(401, "Não autorizado.");
  }

  const { id } = await params;

  try {
    const admin = createAdminClient();

    // 1. Excluir da users_profiles
    const { error: dbError } = await admin
      .from("users_profiles")
      .delete()
      .eq("id", id);

    if (dbError) {
      return scimError(500, `Erro ao excluir perfil de usuário: ${dbError.message}`);
    }

    // 2. Excluir da autenticação do Supabase
    const { error: authError } = await admin.auth.admin.deleteUser(id);
    if (authError) {
      return scimError(500, `Erro ao excluir usuário do Auth: ${authError.message}`);
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    return scimError(500, err instanceof Error ? err.message : "Erro interno.");
  }
}
