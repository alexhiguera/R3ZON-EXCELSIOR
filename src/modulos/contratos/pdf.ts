import "server-only";
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { ContratoFirmado } from "./datos";
import { bloques, type Tramo } from "./markdown";

/**
 * PDF de un contrato firmado. Es una REPRESENTACIÓN del texto que fijó la base
 * al firmar (`signed_text`): la evidencia es el texto y su SHA-256, guardados
 * en la base, no este fichero. Por eso se genera al descargarlo y no se guarda.
 */

const A4 = { ancho: 595.28, alto: 841.89 };
const MARGEN = 56;
const ANCHO_UTIL = A4.ancho - MARGEN * 2;
const TINTA = rgb(0.09, 0.07, 0.15);
const GRIS = rgb(0.4, 0.4, 0.45);

type Pluma = { doc: PDFDocument; pagina: PDFPage; y: number; normal: PDFFont; negrita: PDFFont };

function nuevaPagina(p: Pluma) {
  p.pagina = p.doc.addPage([A4.ancho, A4.alto]);
  p.y = A4.alto - MARGEN;
}

/** Las fuentes estándar solo cubren WinAnsi: lo que no se puede pintar, se sustituye. */
function pintable(fuente: PDFFont, texto: string): string {
  let salida = "";
  for (const c of texto) {
    try {
      fuente.encodeText(c);
      salida += c;
    } catch {
      salida += c === "→" ? "->" : "?";
    }
  }
  return salida;
}

/** Escribe tramos con ajuste de línea; `sangria` para listas. */
function escribir(
  p: Pluma,
  tramos: Tramo[],
  opciones: { tamano: number; sangria?: number; prefijo?: string; color?: ReturnType<typeof rgb> },
) {
  const { tamano, sangria = 0, prefijo, color = TINTA } = opciones;
  const interlinea = tamano * 1.45;
  const palabras = tramos.flatMap((t) =>
    t.texto
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => ({
        texto: pintable(t.negrita ? p.negrita : p.normal, w),
        fuente: t.negrita ? p.negrita : p.normal,
      })),
  );
  const x0 = MARGEN + sangria;
  let linea: typeof palabras = [];
  let ancho = 0;

  const volcar = (primera: boolean) => {
    if (p.y - interlinea < MARGEN + 20) nuevaPagina(p);
    if (primera && prefijo) {
      p.pagina.drawText(prefijo, {
        x: x0 - 14,
        y: p.y - tamano,
        size: tamano,
        font: p.normal,
        color,
      });
    }
    let x = x0;
    for (const w of linea) {
      p.pagina.drawText(w.texto, { x, y: p.y - tamano, size: tamano, font: w.fuente, color });
      x += w.fuente.widthOfTextAtSize(`${w.texto} `, tamano);
    }
    p.y -= interlinea;
  };

  let primera = true;
  for (const w of palabras) {
    const anchoPalabra = w.fuente.widthOfTextAtSize(`${w.texto} `, tamano);
    if (ancho + anchoPalabra > ANCHO_UTIL - sangria && linea.length) {
      volcar(primera);
      primera = false;
      linea = [];
      ancho = 0;
    }
    linea.push(w);
    ancho += anchoPalabra;
  }
  if (linea.length) volcar(primera);
}

export async function pdfContrato(c: ContratoFirmado, referencia: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Contrato ${referencia}`);
  doc.setAuthor("R3ZON");
  doc.setCreator("R3ZON Clientes");
  doc.setProducer("R3ZON Clientes");
  const p: Pluma = {
    doc,
    pagina: doc.addPage([A4.ancho, A4.alto]),
    y: A4.alto - MARGEN,
    normal: await doc.embedFont(StandardFonts.Helvetica),
    negrita: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  // 1. El contrato, tal como se firmó.
  for (const b of bloques(c.signed_text)) {
    if (b.tipo === "titulo") {
      p.y -= b.nivel === 1 ? 6 : 8;
      escribir(
        p,
        b.tramos.map((t) => ({ ...t, negrita: true })),
        { tamano: [16, 12.5, 11][b.nivel - 1]! },
      );
      p.y -= 2;
    } else if (b.tipo === "lista") {
      b.elementos.forEach((e, i) => {
        escribir(p, e, { tamano: 10, sangria: 16, prefijo: b.numerada ? `${i + 1}.` : "•" });
      });
      p.y -= 4;
    } else {
      escribir(p, b.tramos, { tamano: 10 });
      p.y -= 6;
    }
  }
  const fecha = new Date(c.signed_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
  p.y -= 10;
  escribir(
    p,
    [
      {
        texto: `Firmado electrónicamente por ${c.firma.signer_name} (${c.firma.signer_tax_id}), ${c.firma.signer_role}, el ${fecha}.`,
        negrita: true,
      },
    ],
    { tamano: 10 },
  );

  // 2. Hoja de evidencias.
  nuevaPagina(p);
  escribir(p, [{ texto: "Hoja de evidencias de la firma", negrita: true }], { tamano: 16 });
  p.y -= 6;
  const filas: [string, string][] = [
    ["Referencia del contrato", referencia],
    ["Firmante", `${c.firma.signer_name} · ${c.firma.signer_tax_id} · ${c.firma.signer_role}`],
    ["Email de la cuenta", c.firma.signer_email],
    ["Fecha y hora de la firma", `${fecha} (hora de Madrid)`],
    [
      "Verificación de identidad",
      `Código de un solo uso enviado al email de la cuenta y verificado el ${new Date(c.firma.otp_verified_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}`,
    ],
    ["Dirección IP", c.firma.ip || "no registrada"],
    ["SHA-256 del texto firmado", c.text_sha256],
    ["SHA-256 de la firma dibujada", c.firma.signature_sha256],
  ];
  for (const [clave, valor] of filas) {
    escribir(p, [{ texto: clave, negrita: true }], { tamano: 9, color: GRIS });
    escribir(p, [{ texto: valor, negrita: false }], { tamano: 10 });
    p.y -= 4;
  }

  try {
    const png = await doc.embedPng(Buffer.from(c.firma.signature_png, "hex"));
    const escala = Math.min(240 / png.width, 80 / png.height);
    p.y -= 8;
    escribir(p, [{ texto: "Firma", negrita: true }], { tamano: 9, color: GRIS });
    p.pagina.drawImage(png, {
      x: MARGEN,
      y: p.y - png.height * escala,
      width: png.width * escala,
      height: png.height * escala,
    });
    p.y -= png.height * escala + 12;
  } catch {
    escribir(
      p,
      [{ texto: "La firma dibujada no se puede mostrar en este documento.", negrita: false }],
      {
        tamano: 9,
        color: GRIS,
      },
    );
  }

  p.y -= 8;
  escribir(
    p,
    [
      {
        texto:
          "Cómo comprobarlo: el SHA-256 se calcula sobre el texto del contrato tal como se firmó (UTF-8), que R3ZON conserva junto a estas evidencias. Cualquier cambio en el texto produce una huella distinta. Este PDF es una representación de ese texto.",
        negrita: false,
      },
    ],
    { tamano: 8.5, color: GRIS },
  );

  // Pie de página en todas las hojas.
  const paginas = doc.getPages();
  paginas.forEach((pagina, i) => {
    pagina.drawText(`Contrato ${referencia} · Página ${i + 1} de ${paginas.length}`, {
      x: MARGEN,
      y: MARGEN / 2,
      size: 8,
      font: p.normal,
      color: GRIS,
    });
  });

  return doc.save();
}
