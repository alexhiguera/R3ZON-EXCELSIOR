import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/supabase/server";
import { referenciaContrato } from "@/modulos/contratos";
import { contratoFirmado, pdfContrato } from "@/modulos/contratos/servidor";

/**
 * PDF de un contrato firmado. Exige sesión (el proxy no protege las rutas de
 * API por redirección, pero esta no es /api: aun así se comprueba aquí), y la
 * RLS decide si el usuario puede leer ese contrato (su empresa o el equipo).
 * Un contrato ajeno o inexistente responde 404 igual: no se revela cuál existe.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getCurrentUser())) return new NextResponse("No autorizado", { status: 401 });
  if (!z.uuid().safeParse(id).success) return new NextResponse("No encontrado", { status: 404 });

  const r = await contratoFirmado(id);
  if (!r.ok) return new NextResponse("No disponible", { status: 503 });
  if (!r.datos) return new NextResponse("No encontrado", { status: 404 });

  try {
    const referencia = referenciaContrato(id);
    const pdf = await pdfContrato(r.datos, referencia);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="contrato-${referencia}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    logger("modulo/contratos").error("pdf_failed", { name: (err as Error).name });
    return new NextResponse("No se ha podido generar el PDF", { status: 500 });
  }
}
