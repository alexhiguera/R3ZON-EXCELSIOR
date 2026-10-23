// Lee los emails del Mailpit LOCAL (los que envía Supabase Auth en local y en
// los E2E). Solo existe dentro de Docker: nunca hay emails reales.

import { urlCorreoLocal } from "../../scripts/lib/supabase-local.mjs";

/**
 * Último código de 6 cifras enviado a `email` después de `desde` (ms). Reintenta
 * unos segundos: el email tarda un poco en llegar.
 *
 * @param {string} email
 * @param {number} desde marca de tiempo (Date.now()) antes de pedir el código
 * @returns {Promise<string>}
 */
export async function codigoEnviadoA(email, desde) {
  const base = urlCorreoLocal();
  for (let intento = 0; intento < 30; intento++) {
    const r = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages = [] } = await r.json();
    const ultimo = messages.find((m) => new Date(m.Created).getTime() >= desde - 1000);
    if (ultimo) {
      const m = await (await fetch(`${base}/api/v1/message/${ultimo.ID}`)).json();
      const codigo = /\b(\d{6})\b/.exec(m.Text ?? m.HTML ?? "")?.[1];
      if (codigo) return codigo;
    }
    await new Promise((hecho) => setTimeout(hecho, 500));
  }
  throw new Error(`No ha llegado ningún código a ${email}`);
}
