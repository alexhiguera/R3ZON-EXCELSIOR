import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MODULOS } from "@/modulos/registro";

/**
 * Fronteras entre módulos (docs/ARCHITECTURE.md §21). Un módulo solo se usa por
 * su API pública:
 *   · `@/modulos/<m>`          → index.ts (seguro en cliente y servidor)
 *   · `@/modulos/<m>/servidor` → servidor.ts (solo servidor)
 * y solo el registro importa `modulo.ts`. Si un módulo importa las tripas de
 * otro, un cambio interno en uno rompe al otro sin que nadie lo vea venir: eso
 * es lo que convierte un monolito modular en uno que colapsa entero.
 */

const RAIZ = process.cwd();
const MODULOS_DIR = path.join(RAIZ, "src/modulos");
const COMPARTIDOS = new Set(["registro.ts", "tipos.ts"]);

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const abs = path.join(dir, f);
    if (statSync(abs).isDirectory()) return ficheros(abs);
    return /\.(ts|tsx)$/.test(f) ? [abs] : [];
  });
}

const carpetas = readdirSync(MODULOS_DIR).filter((f) =>
  statSync(path.join(MODULOS_DIR, f)).isDirectory(),
);

/** Importaciones de un fichero, por especificador. */
function importsDe(fichero: string): string[] {
  const texto = readFileSync(fichero, "utf8");
  return [...texto.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
}

/** ¿A qué módulo y a qué fichero apunta un import? (null si no es de src/modulos). */
function destino(fichero: string, spec: string): { modulo: string; resto: string } | null {
  let abs: string | null = null;
  if (spec.startsWith("@/modulos/")) abs = path.join(RAIZ, "src", spec.slice(2));
  else if (spec.startsWith(".")) abs = path.resolve(path.dirname(fichero), spec);
  if (!abs?.startsWith(MODULOS_DIR + path.sep)) return null;
  const [modulo, ...resto] = path.relative(MODULOS_DIR, abs).split(path.sep);
  return { modulo: modulo!, resto: resto.join("/") };
}

const PUERTAS_PUBLICAS = new Set(["", "index", "servidor"]);

describe("módulos", () => {
  it("cada carpeta de src/modulos/ está registrada, y cada registro tiene carpeta", () => {
    expect([...carpetas].sort()).toEqual(MODULOS.map((m) => m.id).sort());
  });

  it("ningún módulo importa las tripas de otro", () => {
    const violaciones: string[] = [];
    for (const modulo of carpetas) {
      for (const fichero of ficheros(path.join(MODULOS_DIR, modulo))) {
        for (const spec of importsDe(fichero)) {
          const d = destino(fichero, spec);
          if (!d || d.modulo === modulo || COMPARTIDOS.has(d.modulo)) continue;
          if (!PUERTAS_PUBLICAS.has(d.resto)) {
            violaciones.push(`${path.relative(RAIZ, fichero)} → ${spec}`);
          }
        }
      }
    }
    expect(violaciones).toEqual([]);
  });

  it("fuera de src/modulos/ solo se usan sus puertas públicas", () => {
    const violaciones: string[] = [];
    const fuera = [
      ...ficheros(path.join(RAIZ, "src")).filter((f) => !f.startsWith(MODULOS_DIR)),
      ...ficheros(path.join(RAIZ, "tests")),
    ];
    for (const fichero of fuera) {
      for (const spec of importsDe(fichero)) {
        const d = destino(fichero, spec);
        if (!d || COMPARTIDOS.has(d.modulo)) continue;
        if (!PUERTAS_PUBLICAS.has(d.resto)) {
          violaciones.push(`${path.relative(RAIZ, fichero)} → ${spec}`);
        }
      }
    }
    expect(violaciones).toEqual([]);
  });

  it("la puerta de servidor está marcada como solo servidor", () => {
    const sinMarca = carpetas
      .map((m) => path.join(MODULOS_DIR, m, "servidor.ts"))
      .filter((f) => {
        try {
          statSync(f);
        } catch {
          return false;
        }
        // servidor.ts reexporta: lo que tiene que llevar la marca es lo que reexporta.
        return importsDe(f).some((spec) => {
          const objetivo = path.resolve(path.dirname(f), `${spec}.ts`);
          try {
            return !readFileSync(objetivo, "utf8").includes('import "server-only"');
          } catch {
            return false;
          }
        });
      });
    expect(sinMarca.map((f) => path.relative(RAIZ, f))).toEqual([]);
  });
});
