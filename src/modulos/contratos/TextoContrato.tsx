import { Fragment } from "react";
import { type Bloque, bloques, type Tramo } from "./markdown";

/**
 * Texto de un contrato en pantalla. Sin `dangerouslySetInnerHTML`: el texto se
 * pinta como texto, así que una plantilla o un anexo no pueden colar HTML.
 * Los huecos sin valor («[pendiente: x]») se resaltan para que se vean.
 */

/** Clave estable por posición: el texto de un contrato no se reordena. */
function conClave<T>(elementos: T[], prefijo: string): { clave: string; valor: T }[] {
  return elementos.map((valor, posicion) => ({ clave: `${prefijo}${posicion}`, valor }));
}

export function TextoContrato({ texto }: { texto: string }) {
  return (
    <article className="flex flex-col gap-3 text-sm leading-relaxed" data-testid="texto-contrato">
      {conClave(bloques(texto), "b").map(({ clave, valor }) => (
        <BloqueContrato key={clave} bloque={valor} />
      ))}
    </article>
  );
}

function BloqueContrato({ bloque }: { bloque: Bloque }) {
  if (bloque.tipo === "titulo") {
    const clases = {
      1: "text-xl font-semibold mt-2",
      2: "text-base font-semibold mt-3",
      3: "text-sm font-semibold mt-2",
    }[bloque.nivel];
    // Los niveles van un escalón por debajo: la página ya tiene su <h1>.
    const Etiqueta = (["h2", "h3", "h4"] as const)[bloque.nivel - 1]!;
    return (
      <Etiqueta className={clases}>
        <Tramos tramos={bloque.tramos} />
      </Etiqueta>
    );
  }
  if (bloque.tipo === "lista") {
    const Lista = bloque.numerada ? "ol" : "ul";
    return (
      <Lista
        className={`${bloque.numerada ? "list-decimal" : "list-disc"} flex flex-col gap-1 pl-5`}
      >
        {conClave(bloque.elementos, "e").map(({ clave, valor }) => (
          <li key={clave}>
            <Tramos tramos={valor} />
          </li>
        ))}
      </Lista>
    );
  }
  return (
    <p>
      <Tramos tramos={bloque.tramos} />
    </p>
  );
}

function Tramos({ tramos }: { tramos: Tramo[] }) {
  return (
    <>
      {conClave(tramos, "t").map(({ clave, valor }) => {
        const contenido = conClave(valor.texto.split(/(\[pendiente: [a-z_.]+\])/g), "p").map((p) =>
          p.valor.startsWith("[pendiente: ") ? (
            <mark key={p.clave} className="rounded bg-warning/20 px-1 text-warning">
              {p.valor}
            </mark>
          ) : (
            <Fragment key={p.clave}>{p.valor}</Fragment>
          ),
        );
        return valor.negrita ? (
          <strong key={clave}>{contenido}</strong>
        ) : (
          <Fragment key={clave}>{contenido}</Fragment>
        );
      })}
    </>
  );
}
