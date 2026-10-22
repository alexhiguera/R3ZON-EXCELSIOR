"use client";

import { Button } from "@/components/ui/Button";

/**
 * Error de una página. Sentry lo recibe por `onRequestError` (servidor) o por
 * su propio handler global (navegador); aquí solo se ofrece reintentar.
 */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Algo ha fallado</h1>
      <p className="text-muted">Hemos registrado el error. Puedes volver a intentarlo.</p>
      <div>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </main>
  );
}
