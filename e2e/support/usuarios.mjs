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
