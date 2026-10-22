/**
 * Destino seguro para una redirección que llega de fuera (`?redirect=` del
 * login, `?next=` de `/auth/callback`).
 *
 * Solo se acepta una ruta del propio sitio; todo lo demás cae al valor por
 * defecto, en silencio. Protege de los tres trucos que se encontraron en el
 * proyecto de origen:
 *   · una URL absoluta (`https://copia-del-login…`): el router navega a ella;
 *   · `@evil.example` concatenado al origen: el host pasa a ser `evil.example`;
 *   · `//host` y `/\host`, que el navegador lee como «otro origen».
 *
 * La comprobación final no depende de acordarse de cada truco: resolver la ruta
 * contra un origen ficticio y exigir que siga siendo ese.
 */
const FAKE_ORIGIN = "https://safe-redirect.invalid";

export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;

  // Caracteres de control y barras invertidas: el navegador elimina los
  // primeros y convierte las segundas antes de resolver (`/\t/evil` → `//evil`).
  // biome-ignore lint/suspicious/noControlCharactersInRegex: es justo lo que se busca.
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, FAKE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== FAKE_ORIGIN) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
