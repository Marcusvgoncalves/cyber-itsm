import { getQaResultById } from "@/lib/security-qa/qaRepository";
import { generateProjectPdfBuffer } from "@/lib/security-qa/export-project-pdf";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getQaResultById(id);

    if (!result) {
      return Response.json({ error: "Projeto de Security QA não encontrado." }, { status: 404 });
    }

    const pdfBuffer = await generateProjectPdfBuffer(result);

    return new Response(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="laudo-security-qa-${result.id.slice(0, 8)}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Erro ao gerar PDF do projeto Security QA:", error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
