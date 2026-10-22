import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { project } from "@/config/project";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const destination = safeRedirectPath(params.redirect, project.homePath);

  // Con sesión, el login no tiene nada que hacer.
  if (await getCurrentUser()) redirect(destination);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
      {params.error === "callback" && (
        <p role="alert" className="text-sm text-danger">
          El enlace no es válido o ha caducado. Vuelve a intentarlo.
        </p>
      )}
      <LoginForm redirectTo={params.redirect ? destination : undefined} />
    </main>
  );
}
