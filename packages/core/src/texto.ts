/** Minúsculas, sin acentos y con espacios simples. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clave para reconocer un comercio. Debe coincidir con la función SQL
 * public.normalizar_comercio() (migración inicial).
 */
export function normalizarComercio(texto: string | null | undefined): string {
  return normalizar(texto ?? '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PREFIJOS_PROCESADOR = /^(paypal|merpago|mercadopago|mp|clip ?mx|clip|stripe|sr|dlo|dlocal|ebanx|conekta|openpay|pp|google)\s*\*\s*/i;

/** Deja el nombre de un comercio presentable: "PAYPAL *SPOTIFY 123" → "SPOTIFY". */
export function limpiarComercio(texto: string | null | undefined): string | null {
  if (!texto) return null;
  let limpio = texto
    .replace(/\s+/g, ' ')
    .trim()
    .replace(PREFIJOS_PROCESADOR, '')
    .replace(/^\*+\s*/, '')
    .replace(/\s+(suc(ursal)?\.?|tda\.?|tienda|no\.?)?\s*#?\d{2,}$/i, '')
    .replace(/[\s.,;:*-]+$/, '')
    .trim();
  if (limpio.length > 48) limpio = limpio.slice(0, 48).trim();
  return limpio.length > 0 ? limpio : null;
}
