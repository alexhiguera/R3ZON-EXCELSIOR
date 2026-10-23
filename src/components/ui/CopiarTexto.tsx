"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";

/**
 * Texto que se copia con un botón (el enlace de una invitación). El texto queda
 * visible y seleccionable por si el portapapeles no está disponible (contexto
 * no seguro, permisos), y el resultado se anuncia al lector de pantalla.
 */
export function CopiarTexto({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState<boolean | null>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{etiqueta}</span>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code
          data-testid="texto-copiable"
          className="block min-w-0 flex-1 rounded-xl border border-border bg-white/[0.04] px-4 py-2.5 text-xs break-all select-all"
        >
          {texto}
        </code>
        <Button variant="secondary" onClick={copiar}>
          {copiado ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          {copiado ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <p role="status" className="text-xs text-muted">
        {copiado === false ? "No se ha podido copiar: selecciona el texto y cópialo a mano." : ""}
      </p>
    </div>
  );
}
