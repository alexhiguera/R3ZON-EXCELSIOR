import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolverDestino, soloPublic } from "../../scripts/lib/prisma-db.mjs";
import { puertoDeSeccion, urlBaseLocal } from "../../scripts/lib/supabase-local.mjs";

describe("puertos del stack local", () => {
  it("se leen de supabase/config.toml, su única fuente", () => {
    const toml = readFileSync("supabase/config.toml", "utf8");
    const port = puertoDeSeccion(toml, "db");
    expect(port).toBeTypeOf("number");
    expect(urlBaseLocal()).toBe(`postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);
  });

  it("no confunde el puerto de una sección con el de otra", () => {
    const toml = "[api]\nport = 1\n\n[db]\n# comentario\nport = 2\n[db.pooler]\nport = 3\n";
    expect(puertoDeSeccion(toml, "api")).toBe(1);
    expect(puertoDeSeccion(toml, "db")).toBe(2);
    expect(puertoDeSeccion(toml, "db.pooler")).toBe(3);
    expect(puertoDeSeccion(toml, "studio")).toBeNull();
  });
});

describe("resolverDestino (Prisma solo en local)", () => {
  const local = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

  it("acepta una base local", () => {
    const r = resolverDestino({ explicita: undefined, porDefecto: local });
    expect(r.ok).toBe(true);
  });

  it("rechaza una base remota aunque venga explícita", () => {
    const r = resolverDestino({
      explicita: "postgresql://postgres:secreto@db.abcd.supabase.co:5432/postgres",
      porDefecto: local,
    });
    expect(r).toEqual({ ok: false, motivo: expect.stringContaining("db.abcd.supabase.co") });
  });

  it("nunca muestra la contraseña", () => {
    const r = resolverDestino({ explicita: undefined, porDefecto: local });
    expect(r.ok && r.destino.legible).toBe("postgresql://postgres:****@127.0.0.1:55322/postgres");
  });
});

describe("soloPublic", () => {
  const introspeccion = `generator client {
  provider = "prisma-client"
}

datasource db {
  provider = "postgresql"
  schemas  = ["auth", "public"]
}

model users {
  id       String    @id @db.Uuid
  profiles profiles?

  @@schema("auth")
}

/// Comentario del modelo
model profiles {
  id    String @id @db.Uuid
  users users  @relation(fields: [id], references: [id])

  @@schema("public")
}
`;

  it("deja solo public y quita las relaciones hacia auth", () => {
    const out = soloPublic(introspeccion);
    expect(out).toContain("model profiles {");
    expect(out).toContain("/// Comentario del modelo");
    expect(out).not.toContain("model users");
    expect(out).not.toContain("@relation");
    expect(out).not.toContain("@@schema");
  });

  it("se niega si aparece un esquema inesperado", () => {
    expect(() =>
      soloPublic(`${introspeccion}\nmodel x {\n  id Int @id\n\n  @@schema("storage")\n}\n`),
    ).toThrow(/esquema inesperado/);
  });
});
