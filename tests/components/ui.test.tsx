// @vitest-environment jsdom

/**
 * Primitivos de la interfaz de Excelsior: lo que anuncian a un lector de
 * pantalla y jest-axe sobre cada uno.
 */

import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Stepper } from "@/components/ui/Stepper";

vi.mock("next/navigation", () => ({ usePathname: () => "/inicio" }));

const PASOS = [
  { id: "bienvenida", label: "Bienvenida" },
  { id: "datos", label: "Tus datos" },
  { id: "contrato", label: "Contrato" },
];

describe("Stepper", () => {
  it("marca el paso actual y los completados", () => {
    render(<Stepper steps={PASOS} current={1} />);
    const actual = screen.getByText("Tus datos", { selector: "[aria-current='step']" });
    expect(actual).toBeInTheDocument();
    expect(screen.getByText("(completado)")).toBeInTheDocument();
    expect(screen.getByText(/Paso 2 de 3/)).toBeInTheDocument();
  });

  it("es accesible", async () => {
    const { container } = render(<Stepper steps={PASOS} current={0} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Card y Badge", () => {
  it("son accesibles", async () => {
    const { container } = render(
      <Card>
        <h2>Contrato</h2>
        <Badge tone="warning">Pendiente de firma</Badge>
      </Card>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("AppShell", () => {
  it("marca la sección actual, ofrece salir y es accesible", async () => {
    const { container } = render(
      <AppShell email="cliente@example.test">
        <h1>Inicio</h1>
      </AppShell>,
    );
    const inicio = screen.getAllByRole("link", { name: "Inicio" });
    expect(inicio.every((a) => a.getAttribute("aria-current") === "page")).toBe(true);
    expect(screen.getAllByRole("button", { name: "Cerrar sesión" }).length).toBeGreaterThan(0);
    expect(await axe(container)).toHaveNoViolations();
  });
});
