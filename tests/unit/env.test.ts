import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "@/lib/env";

describe("parsePublicEnv", () => {
  it("acepta una configuración válida", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    });
  });

  it("dice qué falta y dónde se configura", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "no-es-url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.*\.env\.example/,
    );
  });
});
