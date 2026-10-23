"use client";

import { Component, type ReactNode, Suspense } from "react";

/**
 * Cortafuegos de un bloque de la interfaz. Si el módulo de dentro falla al
 * pintarse (también un Server Component asíncrono, cuyo error React reenvía al
 * límite más cercano), se ve un aviso en SU hueco y el resto de la página sigue
 * funcionando. Con `Suspense`, un módulo lento tampoco bloquea a los demás.
 *
 * Es la segunda capa: la primera es que los módulos no lanzan (src/lib/datos.ts).
 */
export function ModuloSeguro({
  nombre,
  children,
  cargando,
}: {
  /** Nombre visible del bloque, para el aviso («Tus empresas no está disponible…»). */
  nombre: string;
  children: ReactNode;
  cargando?: ReactNode;
}) {
  return (
    <LimiteDeError nombre={nombre}>
      <Suspense fallback={cargando ?? <BloqueCargando />}>{children}</Suspense>
    </LimiteDeError>
  );
}

class LimiteDeError extends Component<{ nombre: string; children: ReactNode }, { error: boolean }> {
  override state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  override render() {
    if (this.state.error) return <BloqueNoDisponible nombre={this.props.nombre} />;
    return this.props.children;
  }
}

export function BloqueNoDisponible({ nombre }: { nombre: string }) {
  return (
    <div role="status" className="surface-card rounded-2xl p-5 text-sm text-muted">
      <strong className="text-foreground">{nombre}</strong> no está disponible ahora mismo. El resto
      del área de clientes funciona con normalidad; vuelve a intentarlo en unos minutos.
    </div>
  );
}

function BloqueCargando() {
  return (
    <div aria-hidden="true" className="surface-card h-24 animate-pulse rounded-2xl opacity-60" />
  );
}
