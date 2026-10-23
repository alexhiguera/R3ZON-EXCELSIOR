// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { ModuloSeguro } from "@/components/app-shell/ModuloSeguro";

function Roto(): never {
  throw new Error("el módulo ha fallado");
}

describe("ModuloSeguro", () => {
  it("un módulo que falla no se lleva por delante a sus vecinos", async () => {
    // React registra el error capturado en consola: es lo esperado aquí.
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <main>
        <ModuloSeguro nombre="Facturas">
          <Roto />
        </ModuloSeguro>
        <ModuloSeguro nombre="Proyectos">
          <p>Proyecto web en marcha</p>
        </ModuloSeguro>
      </main>,
    );
    espia.mockRestore();

    expect(screen.getByRole("status")).toHaveTextContent("Facturas no está disponible");
    expect(screen.getByText("Proyecto web en marcha")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
