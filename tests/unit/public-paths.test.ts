import { describe, expect, it } from "vitest";
import { project } from "@/config/project";
import { isPublicPath, matchesPrefix } from "@/lib/public-paths";
import { isApiRoute } from "@/lib/supabase/proxy";

describe("isPublicPath", () => {
  it.each([
    "/",
    "/login",
    "/auth/callback",
    "/auth/logout",
    "/api/health",
    "/legal/privacidad",
    "/invitacion/0123abcd",
  ])("%s es pública", (path) => expect(isPublicPath(path)).toBe(true));

  it.each([
    project.homePath,
    `${project.homePath}/ajustes`,
    "/admin",
    "/loginfalso",
    "/authx",
    "/legales",
    "/invitaciones",
  ])("%s exige sesión", (path) => expect(isPublicPath(path)).toBe(false));
});

describe("matchesPrefix", () => {
  it("casa por segmento, no por texto", () => {
    expect(matchesPrefix("/legal", ["/legal"])).toBe(true);
    expect(matchesPrefix("/legal/cookies", ["/legal"])).toBe(true);
    expect(matchesPrefix("/legalXYZ", ["/legal"])).toBe(false);
  });
});

describe("isApiRoute", () => {
  it("distingue /api de rutas que solo empiezan igual", () => {
    expect(isApiRoute("/api")).toBe(true);
    expect(isApiRoute("/api/health")).toBe(true);
    expect(isApiRoute("/apis")).toBe(false);
  });
});
