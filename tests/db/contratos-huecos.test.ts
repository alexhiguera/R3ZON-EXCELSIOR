import { afterAll, describe, expect, it } from "vitest";
import { HUECOS } from "@/modulos/contratos";
import { db } from "./_db";

/** La interfaz y la base dicen lo mismo sobre huecos y formato. */
afterAll(async () => {
  await db?.end();
});

describe.skipIf(!db)("huecos de los contratos", () => {
  it("la lista de la interfaz es la de contract_placeholder_names()", async () => {
    const { rows } = await db!.query<{ n: string[] }>(
      "select public.contract_placeholder_names() as n",
    );
    expect([...rows[0]!.n].sort()).toEqual(HUECOS.map((h) => h.nombre).sort());
  });

  it.each([
    [150000, "1.500,00 €"],
    [5, "0,05 €"],
    [123456789, "1.234.567,89 €"],
    [0, "0,00 €"],
  ])("format_eur(%d) = %s", async (centimos, esperado) => {
    const { rows } = await db!.query("select public.format_eur($1) as t", [centimos]);
    expect(rows[0].t).toBe(esperado);
  });
});
