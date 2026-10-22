import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Esta página no existe</h1>
      <p className="text-muted">Comprueba la dirección o vuelve al principio.</p>
      <Link href="/" className="text-primary underline">
        Ir a la portada
      </Link>
    </main>
  );
}
