import { getTicketById } from "@/app/actions/tickets";
import { generateTicketPdfBuffer } from "@/lib/tickets/export-ticket-pdf";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticket = await getTicketById(id);

    if (!ticket) {
      return Response.json({ error: "Chamado não encontrado." }, { status: 404 });
    }

    const pdfBuffer = await generateTicketPdfBuffer(ticket);

    return new Response(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="parecer-tecnico-spn-${ticket.id.slice(-6).toUpperCase()}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Erro ao gerar PDF do ticket:", error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
