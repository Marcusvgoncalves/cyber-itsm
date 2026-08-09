import { notFound } from 'next/navigation';
import { isEmbeddableEngineEnabled } from '@/utils/featureFlags';
import { getQaResultById } from '@/lib/security-qa/qaRepository';
import { SecurityQaWidget } from '@/components/embed/security-qa-widget';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Security QA · Embed',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * UI Isolada do Motor Embarcável.
 *
 * Esta rota NÃO importa o Layout principal (AppShell com sidebar/header): o
 * route group `(app)` não é aplicado aqui — a página usa apenas o
 * `app/layout.tsx` raiz (html/body/fonte), permitindo encaixe em iframe de
 * clientes. Os headers de frame (CSP frame-ancestors + X-Frame-Options) são
 * injetados exclusivamente pelo `proxy.ts` para `/embed/*`.
 */
export default async function EmbedSecurityQaPage({ params }: Props) {
  // Kill Switch: nasce desligada. Se OFF, 404 imediato.
  if (!isEmbeddableEngineEnabled()) {
    notFound();
  }

  const { id } = await params;
  const result = await getQaResultById(id);
  if (!result) {
    notFound();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <SecurityQaWidget result={result} />
    </main>
  );
}
