// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type EstadoForm, FormAccion } from "@/components/ui/FormAccion";

describe("FormAccion", () => {
  it("si la acción falla, conserva lo escrito y anuncia el error", async () => {
    const accion = async (_: EstadoForm, d: FormData): Promise<EstadoForm> => ({
      error: `CIF no válido: ${d.get("nif")}`,
    });
    render(
      <FormAccion accion={accion} boton="Guardar">
        <label htmlFor="nif">NIF</label>
        <input id="nif" name="nif" />
      </FormAccion>,
    );
    const campo = screen.getByLabelText("NIF") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "B12345675" } });
    await act(async () => {
      fireEvent.submit(campo.form!);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("CIF no válido: B12345675");
    expect(campo.value).toBe("B12345675");
  });

  it("si sale bien, vacía el formulario y lo dice", async () => {
    const accion = async (): Promise<EstadoForm> => ({ error: null, ok: "Guardado." });
    render(
      <FormAccion accion={accion} boton="Guardar">
        <label htmlFor="t">Título</label>
        <input id="t" name="t" />
      </FormAccion>,
    );
    const campo = screen.getByLabelText("Título") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "Anexo" } });
    await act(async () => {
      fireEvent.submit(campo.form!);
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Guardado.");
    expect(campo.value).toBe("");
  });
});
