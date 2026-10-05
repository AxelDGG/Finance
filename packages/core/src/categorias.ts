import type { Categoria, ReglaCategoria } from './tipos.ts';
import { normalizarComercio } from './texto.ts';

/**
 * Reglas predeterminadas por comercio (México). Se aplican solo si el
 * usuario no tiene una regla propia para ese comercio.
 */
const PREDETERMINADAS: Array<[RegExp, string]> = [
  [/\b(oxxo gas|g500|pemex)\b/, 'Transporte'],
  [/\b(apple store|apple tienda)\b/, 'Compras'],
  [/\b(didi food|uber eats|rappi|sin delantal|ifood|starbucks|cafe|cafeteria|restaurant|restaurante|tacos?|taqueria|burger|mcdonald|kfc|domino|pizza|little caesars|subway|carls jr|vips|sanborns cafe|toks|wings|sushi|italianni|chilis|cinnabon|krispy|dunkin|tim hortons|panaderia|el portón|la casa de toño|comida)\b/, 'Comida'],
  [/\b(oxxo|seven eleven|seven|walmart|wal mart|bodega aurrera|aurrera|soriana|chedraui|la comer|fresko|city market|superama|heb|costco|sams|sam s|mega|calimax|smart|super|abarrotes|circle k|extra|kiosko|tiendas? 3b|neto|ley)\b/, 'Súper'],
  [/\b(uber|didi|cabify|indrive|beat|pemex|gasolin|gas station|oxxo gas|bp|shell|mobil|g500|total energies|metro|metrobus|tag|pase|iave|televia|estacionamiento|parking|vivaaerobus|volaris|aeromexico|ado|etn|primera plus)\b/, 'Transporte'],
  [/\b(spotify|netflix|disney|hbo|max|prime video|amazon prime|apple|icloud|google one|google storage|youtube|crunchyroll|paramount|vix|star plus|deezer|chatgpt|openai|claude|anthropic|microsoft|xbox game pass|playstation plus|nintendo online|duolingo|canva|notion|adobe)\b/, 'Suscripciones'],
  [/\b(cinepolis|cinemex|ticketmaster|eticket|steam|playstation|xbox|nintendo|epic games|boletos|teatro|museo|bar|antro|cantina|six flags|kidzania|bowling)\b/, 'Entretenimiento'],
  [/\b(farmacia|farmacias|benavides|similares|del ahorro|guadalajara|san pablo|yza|hospital|clinica|doctor|dr|laboratorio|chopo|salud digna|optica|dentista|dental)\b/, 'Salud'],
  [/\b(cfe|telmex|izzi|totalplay|telcel|at t|att|megacable|movistar|bait|unefon|sky|dish|agua|sacmex|gas natural|naturgy|predial|tesoreria|sat)\b/, 'Servicios'],
  [/\b(amazon|mercado libre|mercadolibre|liverpool|palacio de hierro|shein|temu|coppel|sears|suburbia|zara|h m|bershka|pull bear|nike|adidas|innovasport|marti|best buy|steren|office depot|officemax|sanborns|aliexpress|apple store)\b/, 'Compras'],
  [/\b(home depot|homedepot|ikea|lowes|comex|truper|ferreteria|tlapaleria|sodimac)\b/, 'Hogar'],
];

/** Devuelve el id de la categoría sugerida para un comercio, o null. */
export function sugerirCategoria(
  comercio: string | null | undefined,
  reglasUsuario: ReglaCategoria[],
  categorias: Categoria[],
): string | null {
  const clave = normalizarComercio(comercio);
  if (!clave) return null;

  // 1) Lo que tú ya corregiste antes: coincidencia exacta o la regla más larga contenida.
  const exacta = reglasUsuario.find((r) => r.patron === clave);
  if (exacta) return exacta.categoria_id;
  const contenida = reglasUsuario
    .filter((r) => r.patron.length >= 3 && (` ${clave} `.includes(` ${r.patron} `) || clave.startsWith(r.patron)))
    .sort((a, b) => b.patron.length - a.patron.length)[0];
  if (contenida) return contenida.categoria_id;

  // 2) Reglas predeterminadas.
  for (const [re, nombre] of PREDETERMINADAS) {
    if (re.test(clave)) return categoriaPorNombre(categorias, nombre);
  }
  return null;
}

export function categoriaPorNombre(categorias: Categoria[], nombre: string): string | null {
  const objetivo = normalizarComercio(nombre);
  return categorias.find((c) => normalizarComercio(c.nombre) === objetivo)?.id ?? null;
}
