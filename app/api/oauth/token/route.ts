import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    let body: Record<string, string> = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        body[key] = value;
      });
    } else {
      body = await req.json();
    }

    const { grant_type, client_id, client_secret, code } = body;

    // Permitir qualquer credencial em ambiente sandbox/demo
    if (grant_type === "client_credentials") {
      return NextResponse.json({
        access_token: `oauth-token-cc-${Math.random().toString(36).substring(2)}`,
        token_type: "Bearer",
        expires_in: 3600,
        scope: "read write userinfo"
      });
    }

    if (grant_type === "authorization_code") {
      if (!code) {
        return NextResponse.json({ error: "invalid_grant", error_description: "Missing authorization code" }, { status: 400 });
      }
      return NextResponse.json({
        access_token: `oauth-token-ac-${Math.random().toString(36).substring(2)}`,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: `oauth-refresh-${Math.random().toString(36).substring(2)}`,
        scope: "read write userinfo"
      });
    }

    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "invalid_request", message: err instanceof Error ? err.message : "Invalid JSON" }, { status: 400 });
  }
}
