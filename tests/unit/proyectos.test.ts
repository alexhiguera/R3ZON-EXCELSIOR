import { describe, expect, it } from "vitest";
import {
  ESTADOS_ELEMENTO,
  ESTADOS_PROYECTO,
  editablePorCliente,
  porcentaje,
  porSeccion,
  TRANSICIONES_PROYECTO,
} from "@/modulos/proyectos";

const vacio = {
  total: 0,
  required_total: 0,
  done: 0,
  required_done: 0,
  changes_requested: 0,
  to_review: 0,
};

describe("proyectos: estados", () => {
  it("cada estado tiene etiqueta y transiciones; cancelado es final", () => {
    expect(Object.keys(TRANSICIONES_PROYECTO).sort()).toEqual(Object.keys(ESTADOS_PROYECTO).sort());
    expect(TRANSICIONES_PROYECTO.cancelado).toEqual([]);
    for (const destinos of Object.values(TRANSICIONES_PROYECTO)) {
      for (const d of destinos) expect(ESTADOS_PROYECTO[d]).toBeDefined();
    }
  });

  it("el cliente no edita lo validado ni un proyecto cancelado", () => {
    expect(editablePorCliente("pendiente", "briefing")).toBe(true);
    expect(editablePorCliente("cambios", "diseno")).toBe(true);
    expect(editablePorCliente("validado", "briefing")).toBe(false);
    expect(editablePorCliente("pendiente", "cancelado")).toBe(false);
    expect(Object.keys(ESTADOS_ELEMENTO)).toContain("cambios");
  });
});

describe("proyectos: progreso", () => {
  it("cuenta lo obligatorio; sin obligatorios, todo; sin elementos, completo", () => {
    expect(porcentaje({ ...vacio, total: 4, required_total: 2, required_done: 1, done: 2 })).toBe(
      50,
    );
    expect(porcentaje({ ...vacio, total: 3, done: 1 })).toBe(33);
    expect(porcentaje(vacio)).toBe(100);
  });

  it("agrupa por sección en el orden en que aparecen", () => {
    const grupos = porSeccion([
      { section: "Marca", id: 1 },
      { section: "Contenido", id: 2 },
      { section: "Marca", id: 3 },
    ]);
    expect(grupos.map(([s, e]) => [s, e.map((x) => x.id)])).toEqual([
      ["Marca", [1, 3]],
      ["Contenido", [2]],
    ]);
  });
});
