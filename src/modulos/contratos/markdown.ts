/**
 * Markdown MÍNIMO de los contratos: lo justo para un documento legal, y nada
 * que permita colar HTML. Lo usan la vista previa y el PDF, así que los dos
 * pintan lo mismo. Pura: se prueba sin montar nada.
 *
 *   # Título · ## Sección · ### Apartado
 *   - elemento de lista   (o «* »)
 *   1. elemento numerado
 *   **negrita** dentro de una línea
 *   línea en blanco = párrafo nuevo
 */

export type Tramo = { texto: string; negrita: boolean };

export type Bloque =
  | { tipo: "titulo"; nivel: 1 | 2 | 3; tramos: Tramo[] }
  | { tipo: "parrafo"; tramos: Tramo[] }
  | { tipo: "lista"; numerada: boolean; elementos: Tramo[][] };

/** «texto **negrita** más» → tramos. Un `**` sin cerrar se queda como texto. */
export function tramos(linea: string): Tramo[] {
  const partes = linea.split("**");
  if (partes.length % 2 === 0) return [{ texto: linea, negrita: false }];
  return partes.map((texto, i) => ({ texto, negrita: i % 2 === 1 })).filter((t) => t.texto !== "");
}

export function bloques(texto: string): Bloque[] {
  const salida: Bloque[] = [];
  let parrafo: string[] = [];
  let lista: { numerada: boolean; elementos: Tramo[][] } | null = null;

  const cerrarParrafo = () => {
    if (parrafo.length) salida.push({ tipo: "parrafo", tramos: tramos(parrafo.join(" ")) });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) salida.push({ tipo: "lista", ...lista });
    lista = null;
  };

  for (const cruda of texto.replace(/\r\n?/g, "\n").split("\n")) {
    const linea = cruda.trim();
    const titulo = /^(#{1,3})\s+(.+)$/.exec(linea);
    const vinyeta = /^[-*]\s+(.+)$/.exec(linea);
    const numero = /^\d+[.)]\s+(.+)$/.exec(linea);

    if (!linea) {
      cerrarParrafo();
      cerrarLista();
    } else if (titulo) {
      cerrarParrafo();
      cerrarLista();
      salida.push({
        tipo: "titulo",
        nivel: titulo[1]!.length as 1 | 2 | 3,
        tramos: tramos(titulo[2]!),
      });
    } else if (vinyeta || numero) {
      cerrarParrafo();
      const numerada = Boolean(numero);
      if (lista && lista.numerada !== numerada) cerrarLista();
      lista ??= { numerada, elementos: [] };
      lista.elementos.push(tramos((vinyeta ?? numero)![1]!));
    } else {
      cerrarLista();
      parrafo.push(linea);
    }
  }
  cerrarParrafo();
  cerrarLista();
  return salida;
}
