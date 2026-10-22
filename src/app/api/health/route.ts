import { NextResponse } from "next/server";

/**
 * Comprobación de vida para monitores externos. Pública y sin tocar la base:
 * dice que la app responde y qué build está sirviendo, nada más.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
}
