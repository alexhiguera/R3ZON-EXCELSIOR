"use client";

import { Eraser, Type } from "lucide-react";
import { type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

const ANCHO = 600;
const ALTO = 200;

/**
 * Firma dibujada con el dedo o el ratón. Deja el PNG en un campo oculto
 * (`name`), que es lo que recibe la firma en el servidor (y la base comprueba
 * que es un PNG). Accesible: quien no pueda dibujar genera la firma a partir de
 * su nombre con «Usar mi nombre», y el estado se anuncia.
 */
export function FirmaDibujada({
  name = "firma",
  campoNombre,
}: {
  name?: string;
  /**
   * `name` del campo (en el mismo formulario) con el nombre del firmante, para
   * «Usar mi nombre». Por nombre y no por id: el id lo pone `<Field>` para
   * enlazar la etiqueta, y pisarlo deja el campo sin nombre accesible.
   */
  campoNombre?: string;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [png, setPng] = useState("");
  const ayudaId = useId();

  useEffect(() => {
    const ctx = lienzo.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#16031c";
  }, []);

  function punto(e: PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * ANCHO,
      y: ((e.clientY - r.top) / r.height) * ALTO,
    };
  }

  function empezar(e: PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const { x, y } = punto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(e: PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = punto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    setPng(lienzo.current?.toDataURL("image/png") ?? "");
  }

  function borrar() {
    lienzo.current?.getContext("2d")?.clearRect(0, 0, ANCHO, ALTO);
    setPng("");
  }

  function usarNombre() {
    const campo = campoNombre
      ? (lienzo.current
          ?.closest("form")
          ?.elements.namedItem(campoNombre) as HTMLInputElement | null)
      : null;
    const texto = campo?.value.trim();
    const ctx = lienzo.current?.getContext("2d");
    if (!ctx || !texto) return;
    borrar();
    ctx.fillStyle = "#16031c";
    ctx.font = "italic 56px 'Segoe Script', 'Brush Script MT', cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, 24, ALTO / 2, ANCHO - 48);
    setPng(lienzo.current?.toDataURL("image/png") ?? "");
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Firma</span>
      <canvas
        ref={lienzo}
        width={ANCHO}
        height={ALTO}
        role="img"
        aria-label={png ? "Firma dibujada" : "Espacio para dibujar la firma, vacío"}
        aria-describedby={ayudaId}
        className="aspect-[3/1] w-full touch-none rounded-xl border border-border bg-white"
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        data-testid="lienzo-firma"
      />
      <p id={ayudaId} className="text-xs text-muted">
        Firma con el dedo o el ratón. Si no puedes, usa tu nombre escrito como firma.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={borrar}>
          <Eraser aria-hidden="true" className="size-4" />
          Borrar
        </Button>
        {campoNombre && (
          <Button variant="ghost" onClick={usarNombre}>
            <Type aria-hidden="true" className="size-4" />
            Usar mi nombre
          </Button>
        )}
      </div>
      <p role="status" className="sr-only">
        {png ? "Firma lista." : ""}
      </p>
      <input type="hidden" name={name} value={png} />
    </div>
  );
}
