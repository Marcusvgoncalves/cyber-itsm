import { NextResponse } from 'next/server';

// Sistema de Mock Avançado de IA SecOps
// Quando a chave de API real (OpenAI/Gemini) for adicionada, 
// este endpoint pode ser substituído pelo Vercel AI SDK.

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

    // Mock delay for realistic typing effect
    await new Promise(resolve => setTimeout(resolve, 800));

    let responseContent = `Baseado na sua requisição, como seu **Agente de IA SecOps**, analisei o cenário sob as óticas dos nossos frameworks de conformidade corporativa:

### 🛡️ Análise de Conformidade e Riscos
- **NIST CSF 2.0**: O evento relatado se enquadra primariamente na função *Detect (DE)* ou *Respond (RS)*. É crítico acionar o plano de resposta a incidentes.
- **CIS Controls (v8)**: Recomendo a validação do Controle 4 (Configuração Segura de Ativos Corporativos) e Controle 5 (Gerenciamento de Contas), garantindo que privilégios mínimos estão aplicados.
- **ISO/IEC 27001:2022**: Observe os controles do anexo A.8 (Segurança Tecnológica), especificamente sobre isolamento de incidentes e proteção contra malware.
- **LGPD & PCI-DSS**: Se houver dados pessoais (PII) ou dados de cartão envolvidos (PAN), o DPO e o comitê de privacidade devem ser notificados imediatamente para conter vazamentos (Art. 48 da LGPD).

**Ação Sugerida:** Recomendo a criação imediata de um Ticket no Kanban sob a categoria de Risco 'Crítico'. Quer que eu detalhe o plano de ação de resposta?`;

    // Alguma inteligência básica para personalizar a resposta baseada no input
    if (lastMessage.includes('senha') || lastMessage.includes('password') || lastMessage.includes('acesso')) {
      responseContent = `Identifiquei que sua dúvida é sobre **Gestão de Acessos e Identidades (IAM)**.

### 🛡️ Mapeamento de Controles IAM
- **CIS Controls (v8)**: Controle 6 (Gerenciamento de Controle de Acesso). Devemos aplicar o princípio de Menor Privilégio.
- **SABSA**: Na camada Lógica (Logical Security Architecture), os serviços de IAM, RBAC e SSO são vitais para mitigar riscos de intrusão.
- **NIST CSF 2.0**: Função *Protect (PR)* - Gestão de Identidades (PR.AA).

**Recomendação Prática:** O CyberITSM SPN já exige senhas complexas (12+ caracteres) e **Autenticação Multi-Fator (MFA/TOTP)** mandatória. Se houver falha de acesso, direcione o analista para o fluxo formal do *Sailpoint IdentityNow* na aba IAM.`;
    } else if (lastMessage.includes('vulnerabilidade') || lastMessage.includes('patch')) {
      responseContent = `Identifiquei o tema de **Gestão de Vulnerabilidades**.

### 🛡️ Mapeamento de Controles
- **CIS Controls (v8)**: Controle 7 (Gerenciamento Contínuo de Vulnerabilidades). É essencial aplicar patches em até 48 horas para CVSS Altos.
- **PCI-DSS (v4.0)**: Requisito 6 (Desenvolver e manter sistemas seguros). O não reparo imediato pode expor o CDE (Cardholder Data Environment).
- **ISO/IEC 27001:2022**: A.8.8 (Gestão de vulnerabilidades técnicas).

**Ação:** Mova o card correspondente no Kanban para "Em Progresso" e documente a evidência de aplicação do patch na atividade.`;
    } else if (lastMessage.includes('arquitet') || lastMessage.includes('framework')) {
      responseContent = `Como **Agente de IA SecOps**, oriento que o design e arquitetura devem aderir aos seguintes frameworks e controles:
      
### 🛡️ Mapeamento de Controles para Arquitetura
- **NIST CSF 2.0**: Função *Protect (PR.DS)* - Segurança de Dados. A arquitetura deve garantir confidencialidade, integridade e disponibilidade.
- **CIS Controls (v8)**: Controle 12 (Gerenciamento de Infraestrutura de Rede). Segregação de redes e arquitetura Zero Trust.
- **ISO/IEC 27001:2022**: Controle A.8.25 (Ciclo de vida de desenvolvimento seguro). Requisitos de segurança embutidos na fase de design.
- **SABSA**: Mapeamento da camada de Arquitetura Lógica, garantindo que IAM, criptografia e logging de auditoria sejam requisitos não funcionais obrigatórios.

**Recomendação Prática:** Sempre adote os princípios de *Security by Design* e *Zero Trust*. Assegure que as integrações sigam padrões seguros de API e autenticação OIDC.`;
    }

    return NextResponse.json({
      role: 'assistant',
      content: responseContent,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno no Agente SecOps' }, { status: 500 });
  }
}
