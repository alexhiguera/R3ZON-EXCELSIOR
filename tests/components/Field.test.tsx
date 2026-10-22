// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

describe("<Field> + <Input>", () => {
  it("enlaza la etiqueta con el control sin ids escritos a mano", () => {
    render(
      <Field label="Email">
        <Input type="email" />
      </Field>,
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  });

  it("con error: marca el campo inválido y lo describe con el mensaje", () => {
    render(
      <Field label="Email" hint="El de tu cuenta" error="Falta el email">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("El de tu cuenta Falta el email");
    expect(screen.getByRole("alert")).toHaveTextContent("Falta el email");
  });

  it("sin error: no se anuncia como inválido", () => {
    render(
      <Field label="Nombre">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Nombre")).not.toHaveAttribute("aria-invalid");
  });
});

describe("<Button>", () => {
  it("es type=button por defecto, para no enviar formularios por accidente", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveAttribute("type", "button");
  });

  it("en carga se deshabilita y se anuncia ocupado", () => {
    render(<Button loading>Guardar</Button>);
    const button = screen.getByRole("button", { name: "Guardar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
