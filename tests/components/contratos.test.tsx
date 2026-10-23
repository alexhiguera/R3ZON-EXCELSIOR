// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { FirmaDibujada, TextoContrato } from "@/modulos/contratos";

describe("TextoContrato", () => {
  it("pinta el texto como texto (sin HTML) y resalta lo pendiente", async () => {
    const { container } = render(
      <TextoContrato
        texto={"# Contrato\n\nFirma: [pendiente: firmante.nombre]\n\n<img src=x onerror=alert(1)>"}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(screen.getByText("[pendiente: firmante.nombre]").tagName).toBe("MARK");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("FirmaDibujada", () => {
  it("es accesible y ofrece firmar con el nombre a quien no puede dibujar", async () => {
    const { container } = render(
      <form>
        <label htmlFor="n">Nombre</label>
        <input id="n" name="nombre" />
        <FirmaDibujada campoNombre="nombre" />
      </form>,
    );
    expect(screen.getByRole("img", { name: /Espacio para dibujar la firma/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usar mi nombre" })).toBeInTheDocument();
    expect(container.querySelector('input[type="hidden"][name="firma"]')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});
