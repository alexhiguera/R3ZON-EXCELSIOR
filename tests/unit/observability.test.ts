import { describe, expect, it } from "vitest";
import { redact } from "@/lib/logger";
import { scrubEvent } from "@/lib/observability/sentry";

describe("redact", () => {
  it("oculta claves que suenan a secreto, a cualquier profundidad", () => {
    expect(
      redact({
        user: "u1",
        access_token: "abc",
        nested: { password: "p", apiKey: "k", ok: 1 },
        list: [{ Authorization: "Bearer x" }],
      }),
    ).toEqual({
      user: "u1",
      access_token: "[REDACTED]",
      nested: { password: "[REDACTED]", apiKey: "[REDACTED]", ok: 1 },
      list: [{ Authorization: "[REDACTED]" }],
    });
  });

  it("corta objetos demasiado profundos en vez de recorrerlos enteros", () => {
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect(JSON.stringify(redact(deep))).toContain("[depth]");
  });
});

describe("scrubEvent (Sentry)", () => {
  it("elimina cookies, cabeceras, querystring, cuerpo y usuario, y redacta extra", () => {
    const event = scrubEvent({
      request: { cookies: "sb=1", headers: { a: 1 }, query_string: "code=xyz", data: "{}" },
      user: { id: "u1", email: "ana@example.test" },
      extra: { token: "t", step: "login" },
    });
    expect(event.request).toEqual({
      cookies: undefined,
      headers: undefined,
      query_string: undefined,
      data: undefined,
    });
    expect(event.user).toBeUndefined();
    expect(event.extra).toEqual({ token: "[REDACTED]", step: "login" });
  });
});
