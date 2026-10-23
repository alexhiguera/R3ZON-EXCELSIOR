import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/app-shell/AuthLayout";
import { project } from "@/config/project";
import { googleAuthEnabled } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { GoogleButton, Separador, tieneFormatoDeToken } from "@/modulos/acceso";
import { AceptarForm } from "./AceptarForm";
import { CrearCuentaForm } from "./CrearCuentaForm";

export const metadata: Metadata = {
  title: "Invitación",
  robots: { index: false, follow: false },
};

/**
 * Entrada por invitación (pública). Única forma de crear una cuenta.
 *
 * La página NO consulta la invitación antes del alta: hacerlo sin sesión exigiría
 * una función ejecutable por `anon`, y el catálogo de seguridad no las admite.
 * La validez la decide la base en el momento del alta (hook) o de la aceptación
 * (trigger), y el mensaje de error dice qué hacer. La bienvenida con el nombre
 * de la empresa y el servicio llega después, ya con sesión (Fase 3).
 */
export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!tieneFormatoDeToken(token)) {
    return (
      <AuthLayout titulo="Enlace no válido">
        <p className="text-sm text-muted">
          Este enlace de invitación no es correcto. Copia el enlace completo del email que te
          enviamos o pide a R3ZON uno nuevo.
        </p>
        <Link href="/login" className="text-sm text-brand underline-offset-4 hover:underline">
          Ir a iniciar sesión
        </Link>
      </AuthLayout>
    );
  }

  const user = await getCurrentUser();
  if (user) {
    return (
      <AuthLayout
        titulo="Aceptar invitación"
        subtitulo={`Has iniciado sesión como ${user.email}. Al aceptar, la empresa que te invita se añade a tu cuenta.`}
      >
        <AceptarForm token={token} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      titulo="Te damos la bienvenida"
      subtitulo={`R3ZON te ha invitado a ${project.name}. Crea tu cuenta para empezar.`}
    >
      {googleAuthEnabled() && (
        <>
          <GoogleButton next={project.homePath} />
          <Separador />
        </>
      )}
      <CrearCuentaForm token={token} />
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={`/login?redirect=${encodeURIComponent(`/invitacion/${token}`)}`}
          className="text-brand underline-offset-4 hover:underline"
        >
          Inicia sesión para aceptarla
        </Link>
      </p>
    </AuthLayout>
  );
}
