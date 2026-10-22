// Configuración del CLI de Prisma. Guía completa: docs/DATABASE.md.
//
// · No carga ningún `.env`. La plantilla de `prisma init` hace
//   `import "dotenv/config"`, y con eso cualquier `npx prisma …` suelto usaría
//   la URL que hubiera en disco sin preguntar a qué base apunta. Aquí la URL la
//   pone `scripts/prisma-db.mjs`, que comprueba antes que es local. Sin URL,
//   `prisma validate` y `prisma format` funcionan igual (no se conectan).
//
// · No hay `migrations`. El esquema lo mandan las migraciones de
//   `supabase/migrations/`, no Prisma Migrate.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
