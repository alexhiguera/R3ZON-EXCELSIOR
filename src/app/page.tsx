import Link from "next/link";
import { project } from "@/config/project";

/**
 * Portada pública. En la plantilla solo demuestra que una ruta pública responde
 * sin sesión; cada producto la sustituye por su propia página.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">{project.name}</h1>
      <p className="text-muted">{project.description}</p>
      <div>
        <Link
          href={project.homePath}
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
