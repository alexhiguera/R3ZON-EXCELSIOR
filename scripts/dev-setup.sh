#!/usr/bin/env bash
# =============================================================================
# Bootstrap del entorno de desarrollo — idempotente
# =============================================================================
# Deja el proyecto listo para `npm run dev` desde cero:
#   1. Comprueba Node y Docker.
#   2. Instala dependencias si faltan.
#   3. Levanta el Supabase local (aplica supabase/migrations/).
#   4. Crea .env.local desde .env.example y le pone las claves del stack LOCAL.
#   5. Crea el usuario de desarrollo.
#
# Garantías:
#   · Nunca toca una base remota: todas las claves salen de `supabase status`.
#   · Se puede ejecutar cuantas veces se quiera.
#   · No sobrescribe variables de .env.local que no sean las del Supabase local.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

paso() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
fallo() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

paso "Comprobando Node y Docker"
node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
esperado=$(cat .nvmrc)
[ "$node_major" = "$esperado" ] || fallo "Node $esperado requerido (tienes $(node -v 2>/dev/null || echo ninguno)). Usa: nvm use"
docker info >/dev/null 2>&1 || fallo "Docker no está arrancado."

paso "Dependencias"
if [ ! -d node_modules ]; then npm ci; else echo "node_modules ya existe (npm ci para reinstalar)."; fi

paso "Supabase local"
npx --no-install supabase start

paso ".env.local"
[ -f .env.local ] || cp .env.example .env.local
eval "$(npx --no-install supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY)=')"
poner() {
  local clave="$1" valor="$2"
  if grep -q "^${clave}=" .env.local; then
    sed -i.bak "s|^${clave}=.*|${clave}=${valor}|" .env.local && rm -f .env.local.bak
  else
    printf '%s=%s\n' "$clave" "$valor" >> .env.local
  fi
}
poner NEXT_PUBLIC_SUPABASE_URL "$API_URL"
poner NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$PUBLISHABLE_KEY"
echo "Claves del Supabase local escritas en .env.local."

paso "Usuario de desarrollo"
npm run -s seed:dev

paso "Listo"
echo "Arranca la app con:  npm run dev  →  http://localhost:3000"
