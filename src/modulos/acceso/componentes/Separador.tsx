/** Línea «o» entre dos formas de entrar. Decorativa para el lector de pantalla. */
export function Separador() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
    </div>
  );
}
