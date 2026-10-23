import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LONGITUD_MINIMA_CONTRASENA } from "@/lib/auth/politica";

describe("política de contraseñas", () => {
  const toml = readFileSync("supabase/config.toml", "utf8");

  it("la longitud mínima del formulario es la que aplica Supabase Auth", () => {
    const enAuth = Number(toml.match(/^minimum_password_length\s*=\s*(\d+)/m)?.[1]);
    expect(enAuth).toBe(LONGITUD_MINIMA_CONTRASENA);
  });

  it("cambiar la contraseña exige una sesión reciente", () => {
    expect(toml).toMatch(/^secure_password_change\s*=\s*true/m);
  });

  it("el alta solo por invitación está activada en local", () => {
    expect(toml).toMatch(
      /\[auth\.hook\.before_user_created\]\s*\nenabled = true\s*\nuri = "pg-functions:\/\/postgres\/public\/hook_before_user_created"/,
    );
  });
});
