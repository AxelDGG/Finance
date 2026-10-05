import { leerMonto } from '../dinero.ts';
import { normalizar } from '../texto.ts';

export interface MontoEncontrado {
  centavos: number;
  indice: number;
  /** true si venía con $ / MXN / pesos; false si solo era un número con decimales. */
  conMoneda: boolean;
}

const NUMERO = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`;
const CON_SIGNO = new RegExp(String.raw`(?:\$|\bMXN\b|\bM\.?N\.?(?=\s)|\bMX\$)\s?` + NUMERO, 'gi');
const CON_SUFIJO = new RegExp(NUMERO + String.raw`\s?(?:MXN|M\.N\.|pesos)\b`, 'gi');
const SOLO_DECIMALES = /\b(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})\b/g;

/** Palabras que, justo antes de un monto, indican que NO es el monto del movimiento. */
const ANTES_NO_ES_MONTO = /(saldo|disponible|limite|l[ií]mite|balance|pago minimo|pago m[ií]nimo)[^$\d]{0,25}$/i;

/** Busca todos los montos del texto en orden de aparición. */
export function buscarMontos(texto: string): MontoEncontrado[] {
  const encontrados: MontoEncontrado[] = [];
  const agregar = (re: RegExp, conMoneda: boolean) => {
    for (const m of texto.matchAll(re)) {
      const centavos = leerMonto(m[1] ?? '');
      const indice = m.index ?? 0;
      if (centavos == null) continue;
      if (encontrados.some((e) => Math.abs(e.indice - indice) < 6)) continue;
      encontrados.push({ centavos, indice, conMoneda });
    }
  };
  agregar(CON_SIGNO, true);
  agregar(CON_SUFIJO, true);
  agregar(SOLO_DECIMALES, false);
  return encontrados.sort((a, b) => a.indice - b.indice);
}

/** El monto del movimiento: el primero que no sea un saldo o un límite. */
export function montoPrincipal(texto: string): MontoEncontrado | null {
  const montos = buscarMontos(texto).filter((m) => !ANTES_NO_ES_MONTO.test(texto.slice(Math.max(0, m.indice - 40), m.indice)));
  return montos.find((m) => m.conMoneda) ?? montos[0] ?? null;
}

/** Últimos 4 dígitos de la tarjeta o cuenta que se menciona. */
export function buscarTerminacion(texto: string): string | null {
  const patrones = [
    /terminaci[oó]n\s*(?:en\s*)?[:#*•·x.]*\s*(\d{4})\b/i,
    /termina(?:da)?\s+en\s*[*•·x.]*\s*(\d{4})\b/i,
    /[*•·]{1,}\s?(\d{4})\b/,
    /\bx{2,}\s?(\d{4})\b/i,
    /(?:tarjeta|cuenta|t\.?d\.?|tdd|tdc)\s*(?:de\s+d[eé]bito\s*)?(?:no\.?\s*)?[:#]?\s*(\d{4})\b/i,
  ];
  for (const p of patrones) {
    const m = texto.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Para transferencias: cuenta destino ("a la cuenta *1234", "a tu cuenta terminación 1234"). */
export function buscarTerminacionDestino(texto: string): string | null {
  const m = texto.match(/\b(?:a|hacia|destino:?)\s+(?:la|tu|su)?\s*(?:cuenta|tarjeta|clabe)\s*(?:terminaci[oó]n|termina en)?\s*[:#*•·x.]*\s*(\d{4})\b/i);
  return m?.[1] ?? null;
}

const FIN_COMERCIO = String.raw`(?=\s+(?:con|el|por|a las|a tu|a la|desde|de tu|usando|mediante|el d[ií]a|hoy|ayer|ref|referencia|autorizaci[oó]n|folio|en la|en tu)\b|\s*[.,;\n(]|\s+\d{1,2}[:/]|\s*$)`;

/** Comercio de una compra: "en OXXO SUC 123 con tu tarjeta" → "OXXO SUC 123". */
export function buscarComercio(texto: string): string | null {
  const patrones = [
    // "Comercio: FARMACIAS DEL AHORRO 22 Tarjeta: **4321" (se detiene en la siguiente etiqueta)
    /(?:comercio|establecimiento|negocio)\s*:?\s*([^\n.,;:]{2,48}?)(?=\s+[A-Za-zÁÉÍÓÚáéíóú]+\s*:|[\n.,;]|$)/i,
    new RegExp(String.raw`\ben\s+(?!(?:tu|su|la|el|l[ií]nea|efectivo|cajero|un|una)\b)([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ*'&][A-Za-z0-9ÁÉÍÓÚÑáéíóúñ *'&.\-/]{1,46}?)` + FIN_COMERCIO, 'i'),
    // "cargo de $129.00 de SPOTIFY a tu tarjeta" (solo nombres en mayúsculas)
    new RegExp(String.raw`\bde\s+([A-Z][A-Z0-9 *'&.\-/]{1,46}?)` + FIN_COMERCIO),
    new RegExp(String.raw`\ba\s+(?!(?:tu|su|la|las|el|un|una|cuenta|tarjeta)\b)([A-Z0-9][A-Z0-9 *'&.\-/]{1,46}?)` + FIN_COMERCIO),
  ];
  for (const p of patrones) {
    const m = texto.match(p);
    const c = m?.[1]?.trim();
    if (c && /[a-z]/i.test(c)) return c;
  }
  return null;
}

/** Contraparte de una transferencia: "a Juan Pérez", "de EMPRESA SA DE CV". */
export function buscarContraparte(texto: string, direccion: 'enviada' | 'recibida'): string | null {
  const palabra = direccion === 'enviada' ? '(?:a|para|beneficiario:?)' : '(?:de|ordenante:?|remitente:?)';
  const re = new RegExp(
    String.raw`\b${palabra}\s+(?!(?:tu|su|la|el|un|una|cuenta|tarjeta|la cuenta|tu cuenta|\$)\b)([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ .&]{2,48}?)` + FIN_COMERCIO,
    'i',
  );
  const m = texto.match(re);
  const c = m?.[1]?.trim();
  return c && c.length >= 3 ? c : null;
}

export function contiene(texto: string, re: RegExp): boolean {
  return re.test(normalizar(texto));
}
