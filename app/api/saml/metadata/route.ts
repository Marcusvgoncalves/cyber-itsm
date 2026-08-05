import { NextResponse } from "next/server";

export async function GET() {
  const samlXmlMetadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor entityID="https://cyber-itsm.vercel.app/api/saml/metadata" 
                     xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" 
                      AuthnRequestsSigned="false" 
                      WantAssertionsSigned="true">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
                                   Location="https://cyber-itsm.vercel.app/api/saml/sso" 
                                   index="1" 
                                   isDefault="true"/>
  </md:SPSSODescriptor>
  <md:Organization>
    <md:OrganizationName xml:lang="pt">CyberITSM SPN</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="pt">CyberITSM Security Platform</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="pt">https://cyber-itsm.vercel.app</md:OrganizationURL>
  </md:Organization>
</md:EntityDescriptor>`;

  return new Response(samlXmlMetadata, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}
