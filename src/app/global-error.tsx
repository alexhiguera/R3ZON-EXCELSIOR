"use client";

import { htmlLang } from "@/config/project";

/**
 * Error en el propio layout raíz: sustituye a todo el documento, así que no
 * puede depender de estilos ni componentes de la app.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang={htmlLang}>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1>Algo ha fallado</h1>
        <p>Hemos registrado el error. Puedes volver a intentarlo.</p>
        <button type="button" onClick={reset}>
          Reintentar
        </button>
      </body>
    </html>
  );
}
