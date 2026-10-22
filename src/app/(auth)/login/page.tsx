import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/app-shell/AuthLayout";
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
    <AuthLayout
      titulo="Iniciar sesión"
      subtitulo="Accede a tu área de cliente para ver tus servicios, contratos y proyectos."
    >
      {params.error === "callback" && (
        <p role="alert" className="text-sm text-danger">
          El enlace no es válido o ha caducado. Vuelve a intentarlo.
        </p>
      )}
      <LoginForm redirectTo={params.redirect ? destination : undefined} />
      {/*
       * No hay «Crear cuenta»: las cuentas nacen solo de una invitación de
       * R3ZON (docs/PRODUCTO.md §4, docs/AUTH.md → Previsto en Excelsior).
       */}
      <p className="text-center text-xs text-muted">
        ¿Aún no tienes cuenta? Te la crearemos al empezar a trabajar juntos: recibirás una
        invitación por email.
      </p>
    </AuthLayout>
  );
}
