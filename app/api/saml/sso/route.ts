import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let samlRequest = "";
    let relayState = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      samlRequest = params.get("SAMLRequest") || "";
      relayState = params.get("RelayState") || "/dashboard";
    }

    // Mock do Assertion Consumer Service (ACS) e SAML Response Assertion
    const samlResponseXml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response ID="_${Math.random().toString(36).substring(2)}" 
                Version="2.0" 
                IssueInstant="${new Date().toISOString()}" 
                Destination="https://cyber-itsm.vercel.app/api/saml/sso" 
                xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" 
                xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Issuer>https://entra.microsoft.com/idp/cyberitsm</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion ID="_${Math.random().toString(36).substring(2)}" IssueInstant="${new Date().toISOString()}" Version="2.0">
    <saml:Issuer>https://entra.microsoft.com/idp/cyberitsm</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">secops.admin@cyberitsm.local</saml:NameID>
    </saml:Subject>
    <saml:AttributeStatement>
      <saml:Attribute Name="User.FullName"><saml:AttributeValue>SecOps Admin</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="User.Role"><saml:AttributeValue>admin</saml:AttributeValue></saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

    return NextResponse.json({
      success: true,
      message: "SAML assertion processed successfully",
      assertion: samlResponseXml,
      relayState,
      user: {
        email: "secops.admin@cyberitsm.local",
        name: "SecOps Admin",
        role: "admin",
        provider: "saml_azure_ad"
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Retorna página de teste de SSO SAML
  return new Response(`
    <html>
      <head>
        <title>SAML SSO Login (Mock Integration)</title>
        <style>
          body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f8fafc; }
          .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 400px; text-align: center; }
          h2 { color: #5a00c8; margin-top: 0; }
          p { color: #64748b; font-size: 14px; line-height: 1.5; }
          .btn { display: inline-block; background: #5a00c8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>SAML 2.0 Identity Provider (IdP)</h2>
          <p>Você está acessando a simulação de SSO SAML corporativa para o CyberITSM SPN.</p>
          <a href="/dashboard" class="btn">Continuar via SSO</a>
        </div>
      </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html" }
  });
}
