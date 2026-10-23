import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todas las respuestas. Una CSP completa depende de
 * qué terceros cargue cada producto, así que no va en la plantilla: está en
 * docs/mejoras.md con lo que hay que decidir antes de escribirla.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Sin `preload`: entrar en la lista de precarga de los navegadores es un
  // compromiso del DOMINIO (difícil de deshacer) que decide cada producto.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

/**
 * El plugin de Sentry solo sube los source maps. Sin `SENTRY_AUTH_TOKEN` (local,
 * CI, proyecto recién creado) no se envuelve la config: el build no depende de
 * ningún secreto para pasar.
 */
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
    })
  : nextConfig;
