import { HUECOS } from "@/modulos/contratos";

/** Lista de huecos disponibles, agrupados, para quien escribe una plantilla. */
export function AyudaHuecos() {
  const grupos = [...new Set(HUECOS.map((h) => h.grupo))];
  return (
    <details className="rounded-xl border border-border p-4 text-sm">
      <summary className="cursor-pointer font-medium">Huecos disponibles y formato</summary>
      <p className="mt-3 text-muted">
        Escribe un hueco entre llaves dobles, p. ej. <code>{"{{cliente.razon_social}}"}</code>. Un
        hueco que no esté en esta lista no se guarda. Formato: <code># Título</code>,{" "}
        <code>## Sección</code>, <code>- elemento</code>, <code>1. elemento</code> y{" "}
        <code>**negrita**</code>.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {grupos.map((g) => (
          <div key={g}>
            <h3 className="mb-1 text-xs tracking-widest text-lavender uppercase">{g}</h3>
            <ul className="flex flex-col gap-1">
              {HUECOS.filter((h) => h.grupo === g).map((h) => (
                <li key={h.nombre}>
                  <code className="text-brand">{`{{${h.nombre}}}`}</code>{" "}
                  <span className="text-muted">{h.ayuda}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
