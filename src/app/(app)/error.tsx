"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Error dentro de la zona con sesión. Vive DEBAJO del layout de `(app)`: la
 * navegación y la cabecera siguen en pie y el usuario puede ir a otra sección.
 * Un fallo de un apartado no tumba el área de clientes entera.
 */
export default function ErrorDeSeccion({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El detalle va a Sentry (instrumentation) y a los logs del servidor; aquí
    // solo la referencia, que es lo que el usuario puede darnos.
    console.error("seccion_error", error.digest);
  }, [error]);

  return (
    <div role="alert" className="surface-card flex flex-col gap-4 rounded-2xl p-6">
      <h1 className="text-xl font-semibold">Esta sección no ha podido cargarse</h1>
      <p className="text-sm text-muted">
        El resto del área de clientes sigue disponible desde el menú. Si se repite, escríbenos
        {error.digest ? (
          <>
            {" "}
            con esta referencia: <code className="text-foreground">{error.digest}</code>
          </>
        ) : null}
        .
      </p>
      <div>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </div>
  );
}
