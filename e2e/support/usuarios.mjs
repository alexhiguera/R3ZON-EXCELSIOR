// Usuarios que siembra `npm run seed:e2e` y que usan los specs de Playwright.
// Viven en un único fichero .mjs porque los leen los dos lados: el script de
// Node que los crea y los specs TypeScript que inician sesión con ellos.
//
// Son credenciales del stack LOCAL, desechables: el seed las restablece en cada
// ejecución y nunca existen fuera de Docker.

export const USUARIO_E2E = {
  email: "e2e@example.test",
  password: "e2e-password-local-only",
  displayName: "Usuario E2E",
};

/** Administrador de R3ZON (nivel `admin`): panel, catálogo y clientes. */
export const ADMIN_E2E = {
  email: "admin-e2e@r3zon.test",
  password: "admin-e2e-password-local-only",
  displayName: "Admin E2E",
};
