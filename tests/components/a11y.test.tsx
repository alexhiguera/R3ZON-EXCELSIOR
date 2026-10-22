// @vitest-environment jsdom

/**
 * jest-axe sobre los primitivos por los que pasa toda la UI. Un fallo aquí es
 * un fallo en todas las pantallas a la vez, no en una.
 *
 * El formulario de login se prueba además porque es la primera pantalla que ve
 * cualquier usuario de cualquier producto.
 */

import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

// La Server Action no se ejecuta en jsdom: basta con que exista.
vi.mock("@/app/(auth)/login/actions", () => ({ signIn: vi.fn() }));
const { LoginForm } = await import("@/app/(auth)/login/LoginForm");

describe("accesibilidad", () => {
  it("formulario con campos, ayuda y error", async () => {
    const { container } = render(
      <form>
        <Field label="Nombre" hint="Como quieres que te llamemos">
          <Input />
        </Field>
        <Field label="Email" error="Escribe un email válido">
          <Input type="email" />
        </Field>
        <Button type="submit">Guardar</Button>
      </form>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("botón en estado de carga", async () => {
    const { container } = render(<Button loading>Enviando</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("formulario de login", async () => {
    const { container } = render(<LoginForm redirectTo="/inicio" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
