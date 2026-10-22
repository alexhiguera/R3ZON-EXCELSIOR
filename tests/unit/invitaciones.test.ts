import { describe, expect, it } from "vitest";
import {
  MENSAJE_INVITACION_NO_VALIDA,
  mensajeErrorAceptar,
  mensajeErrorAlta,
  tieneFormatoDeToken,
} from "@/lib/invitaciones";

describe("tieneFormatoDeToken", () => {
  it("acepta 64 caracteres hexadecimales en minúscula", () => {
    expect(tieneFormatoDeToken("a1".repeat(32))).toBe(true);
  });

  it.each(["", "abc", "A1".repeat(32), `${"a1".repeat(32)}0`, `${"a1".repeat(31)}zz`, "../../etc"])(
    "rechaza %j",
    (t) => expect(tieneFormatoDeToken(t)).toBe(false),
  );
});

describe("mensajeErrorAlta", () => {
  it("el rechazo del hook no revela si el email tiene invitación", () => {
    expect(mensajeErrorAlta({ status: 403 })).toBe(MENSAJE_INVITACION_NO_VALIDA);
  });

  it("una cuenta existente lleva a iniciar sesión", () => {
    expect(mensajeErrorAlta({ code: "user_already_exists", status: 422 })).toMatch(/Inicia sesión/);
  });

  it("contraseña débil y exceso de intentos tienen su propio mensaje", () => {
    expect(mensajeErrorAlta({ code: "weak_password" })).toMatch(/contraseña/);
    expect(mensajeErrorAlta({ status: 429 })).toMatch(/intentos/);
  });
});

describe("mensajeErrorAceptar", () => {
  it("distingue el email equivocado del resto", () => {
    expect(mensajeErrorAceptar("La invitación es para otro email")).toMatch(/otro email/);
    expect(mensajeErrorAceptar("La invitación no es válida")).toMatch(/no es válida/);
    expect(mensajeErrorAceptar(undefined)).toMatch(/no es válida/);
  });
});
