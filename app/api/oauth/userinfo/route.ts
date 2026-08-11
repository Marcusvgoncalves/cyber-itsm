import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "invalid_token", message: "Bearer token missing" }, { status: 401 });
  }

  // Retorna informações mockadas padrão do usuário corporativo de SecOps para o sandbox
  return NextResponse.json({
    sub: "usr-admin-itsm-001",
    name: "SecOps Admin",
    email: "secops.admin@cyberitsm.local",
    email_verified: true,
    picture: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop",
    department: "Cyber Security Operations",
    role: "admin",
    organization: "CyberITSM Enterprise"
  });
}
