// Análisis del gasto: en qué se va el dinero y recomendaciones en palabras normales.
import type { Categoria, Movimiento } from './tipos.ts';
import { formatoMXN } from './dinero.ts';
import { diasEnMes, nombrePeriodo, partes, periodoDe, sumarMeses } from './fechas.ts';
import { esGasto } from './resumen.ts';
import { normalizarComercio } from './texto.ts';

const pesos = (c: number) => formatoMXN(c, { decimales: 'nunca' });
const SIN_CATEGORIA = { id: null as string | null, nombre: 'Sin categoría', color: '#34363D' };
const categoriaDe = (m: Movimiento, categorias: Categoria[]) => categorias.find((c) => c.id === m.categoria_id) ?? SIN_CATEGORIA;

export interface CambioCategoria {
  categoria_id: string | null;
  nombre: string;
  color: string;
  /** Este mes hasta hoy. */
  actual: number;
  /** El mes pasado hasta el mismo día. */
  anterior: number;
  /** Diferencia en % (null si el mes pasado no hubo gasto). */
  cambioPct: number | null;
}

/** Cada categoría este mes contra el mes pasado al mismo día (comparación justa). */
export function compararCategorias(movimientos: Movimiento[], categorias: Categoria[], ahora: Date = new Date()): CambioCategoria[] {
  const periodo = periodoDe(ahora);
  const anterior = sumarMeses(periodo, -1);
  const hoy = partes(ahora).dia;
  const grupos = new Map<string | null, CambioCategoria>();
  for (const m of movimientos) {
    if (!esGasto(m)) continue;
    const p = periodoDe(m.fecha);
    const esActual = p === periodo;
    const esAnterior = p === anterior && partes(m.fecha).dia <= hoy;
    if (!esActual && !esAnterior) continue;
    const c = categoriaDe(m, categorias);
    const g = grupos.get(c.id) ?? { categoria_id: c.id, nombre: c.nombre, color: c.color, actual: 0, anterior: 0, cambioPct: null };
    if (esActual) g.actual += m.monto_centavos;
    else g.anterior += m.monto_centavos;
    grupos.set(c.id, g);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, cambioPct: g.anterior > 0 ? ((g.actual - g.anterior) / g.anterior) * 100 : null }))
    .sort((a, b) => b.actual - a.actual || b.anterior - a.anterior);
}

export interface Comercio {
  clave: string;
  nombre: string;
  veces: number;
  total: number;
}

/** Dónde gastas más en un mes (agrupa "OXXO", "Oxxo Centro"… por nombre normalizado). */
export function topComercios(movimientos: Movimiento[], periodo: string, n = 5): Comercio[] {
  const grupos = new Map<string, Comercio & { nombres: Map<string, number> }>();
  for (const m of movimientos) {
    if (!esGasto(m) || !m.comercio || periodoDe(m.fecha) !== periodo) continue;
    const clave = normalizarComercio(m.comercio);
    if (!clave) continue;
    const g = grupos.get(clave) ?? { clave, nombre: m.comercio, veces: 0, total: 0, nombres: new Map() };
    g.veces++;
    g.total += m.monto_centavos;
    g.nombres.set(m.comercio, (g.nombres.get(m.comercio) ?? 0) + 1);
    grupos.set(clave, g);
  }
  return [...grupos.values()]
    .map(({ nombres, ...g }) => ({ ...g, nombre: [...nombres.entries()].sort((a, b) => b[1] - a[1])[0]![0] }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

export interface MesPorCategoria {
  periodo: string;
  corta: string;
  etiqueta: string;
  enCurso: boolean;
  total: number;
  /** Monto por clave de categoría (las de `series`). */
  montos: Record<string, number>;
}

export interface GastoPorCategoriaMeses {
  /** Las categorías que se dibujan (las más grandes; el resto se junta en "Otras"). */
  series: Array<{ clave: string; nombre: string; color: string; total: number }>;
  meses: MesPorCategoria[];
}

/** Gasto de los últimos `n` meses separado por categoría (para barras apiladas). */
export function gastosPorCategoriaMeses(movimientos: Movimiento[], categorias: Categoria[], ahora: Date = new Date(), n = 6, maxSeries = 5): GastoPorCategoriaMeses {
  const actual = periodoDe(ahora);
  const periodos = Array.from({ length: n }, (_, i) => sumarMeses(actual, i - n + 1));
  const enRango = new Set(periodos);
  const gastos = movimientos.filter((m) => esGasto(m) && enRango.has(periodoDe(m.fecha)));

  const totales = new Map<string, { nombre: string; color: string; total: number }>();
  for (const m of gastos) {
    const c = categoriaDe(m, categorias);
    const clave = c.id ?? 'sin';
    const t = totales.get(clave) ?? { nombre: c.nombre, color: c.color, total: 0 };
    t.total += m.monto_centavos;
    totales.set(clave, t);
  }
  const ordenadas = [...totales.entries()].sort((a, b) => b[1].total - a[1].total);
  const visibles = ordenadas.slice(0, ordenadas.length > maxSeries ? maxSeries - 1 : maxSeries);
  const claves = new Set(visibles.map(([k]) => k));
  const restantes = ordenadas.filter(([k]) => !claves.has(k));
  const series = visibles.map(([clave, t]) => ({ clave, ...t }));
  if (restantes.length > 0) series.push({ clave: 'otras', nombre: 'Otras', color: '#4B4E57', total: restantes.reduce((a, [, t]) => a + t.total, 0) });

  const meses = periodos.map((periodo) => {
    const montos: Record<string, number> = {};
    let total = 0;
    for (const m of gastos) {
      if (periodoDe(m.fecha) !== periodo) continue;
      const id = categoriaDe(m, categorias).id ?? 'sin';
      const clave = claves.has(id) ? id : 'otras';
      montos[clave] = (montos[clave] ?? 0) + m.monto_centavos;
      total += m.monto_centavos;
    }
    const nombre = nombrePeriodo(periodo, true).split(' ')[0] ?? '';
    return {
      periodo,
      corta: (nombrePeriodo(periodo).split(' ')[0] ?? '').replace(/^./, (c) => c.toUpperCase()),
      etiqueta: `${nombre.replace(/^./, (c) => c.toUpperCase())}${periodo === actual ? ' · en curso' : ''}`,
      enCurso: periodo === actual,
      total,
      montos,
    };
  });
  return { series, meses };
}

export type NivelRecomendacion = 'alerta' | 'aviso' | 'idea' | 'bien';

export interface Recomendacion {
  /** Identificador estable (para animaciones y para no repetir). */
  id: string;
  nivel: NivelRecomendacion;
  titulo: string;
  texto: string;
  categoria_id?: string | null;
}

export interface DatosRecomendaciones {
  movimientos: Movimiento[];
  categorias: Categoria[];
  /** Presupuesto de Gastos personales de este mes. */
  presupuesto: number;
  metas: Array<{ nombre: string; meta: number; aporte: number; lograda: boolean }>;
  /** Lo que falta mover a los apartados este mes. */
  pendientePorMover: number;
  ahora?: Date;
}

const ORDEN: Record<NivelRecomendacion, number> = { alerta: 0, aviso: 1, idea: 2, bien: 3 };

/**
 * Recomendaciones en palabras normales a partir de tus movimientos: ritmo de
 * gasto contra el presupuesto, categorías que crecieron, dónde se concentra tu
 * gasto, apartados pendientes y metas sin aportación. Como máximo `max`.
 */
export function recomendaciones(d: DatosRecomendaciones, max = 5): Recomendacion[] {
  const ahora = d.ahora ?? new Date();
  const periodo = periodoDe(ahora);
  const dia = partes(ahora).dia;
  const dias = diasEnMes(periodo);
  const delMes = d.movimientos.filter((m) => esGasto(m) && periodoDe(m.fecha) === periodo);
  const gastado = delMes.reduce((a, m) => a + m.monto_centavos, 0);
  const lista: Recomendacion[] = [];

  // 1) Ritmo de gasto contra el presupuesto.
  if (d.presupuesto > 0 && gastado > d.presupuesto) {
    lista.push({ id: 'excedido', nivel: 'alerta', titulo: 'Te pasaste del presupuesto', texto: `Llevas ${pesos(gastado)} de ${pesos(d.presupuesto)}: ${pesos(gastado - d.presupuesto)} de más. Lo que gastes de aquí a fin de mes sale de tus ahorros o metas.` });
  } else if (d.presupuesto > 0 && gastado > 0 && dia >= 5) {
    const proyeccion = Math.round((gastado / dia) * dias);
    const restantes = dias - dia + 1;
    const porDia = Math.max(0, Math.floor((d.presupuesto - gastado) / restantes));
    if (proyeccion > d.presupuesto * 1.05) {
      lista.push({ id: 'ritmo-alto', nivel: 'alerta', titulo: 'A este ritmo te vas a pasar', texto: `Llevas ${pesos(gastado)} en ${dia} días. Si sigues así cerrarías el mes en ${pesos(proyeccion)}, ${pesos(proyeccion - d.presupuesto)} más que tu presupuesto. Para no pasarte, gasta máximo ${pesos(porDia)} al día.` });
    } else if (proyeccion < d.presupuesto * 0.85) {
      lista.push({ id: 'ritmo-bien', nivel: 'bien', titulo: 'Vas bien este mes', texto: `A este ritmo te sobrarían unos ${pesos(d.presupuesto - proyeccion)}. Al cerrar el mes puedes mandarlos a una meta.` });
    }
  }

  // 2) Categorías que crecieron contra el mes pasado al mismo día.
  const cambios = compararCategorias(d.movimientos, d.categorias, ahora);
  const subidas = cambios
    .filter((c) => c.categoria_id && c.actual >= 30_000 && ((c.cambioPct != null && c.cambioPct >= 30 && c.actual - c.anterior >= 20_000) || (c.anterior === 0 && c.actual >= 50_000)))
    .sort((a, b) => b.actual - b.anterior - (a.actual - a.anterior))
    .slice(0, 2);
  for (const c of subidas) {
    lista.push({
      id: `sube-${c.categoria_id}`,
      nivel: 'aviso',
      titulo: `Gastas más en ${c.nombre}`,
      texto:
        c.anterior > 0
          ? `Llevas ${pesos(c.actual)} este mes, ${Math.round(c.cambioPct!)} % más que el mes pasado a estas alturas (${pesos(c.anterior)}).`
          : `Llevas ${pesos(c.actual)} este mes y el mes pasado a estas alturas no habías gastado nada aquí.`,
      categoria_id: c.categoria_id,
    });
  }

  // 3) Dónde se concentra el gasto.
  const mayor = cambios[0];
  const cuantosMayor = mayor ? delMes.filter((m) => (categoriaDe(m, d.categorias).id ?? null) === mayor.categoria_id).length : 0;
  if (mayor && mayor.categoria_id && gastado > 0 && mayor.actual / gastado >= 0.4 && cuantosMayor >= 3 && !subidas.some((s) => s.categoria_id === mayor.categoria_id)) {
    lista.push({
      id: `mayor-${mayor.categoria_id}`,
      nivel: 'idea',
      titulo: `${mayor.nombre} es el ${Math.round((mayor.actual / gastado) * 100)} % de tus gastos`,
      texto: `Es tu mayor gasto del mes (${pesos(mayor.actual)}). Recortar un 10 % ahí te ahorraría unos ${pesos(Math.round(mayor.actual * 0.1))} al mes.`,
      categoria_id: mayor.categoria_id,
    });
  }

  // 4) Un comercio al que vas muy seguido.
  const frecuente = topComercios(d.movimientos, periodo, 10).sort((a, b) => b.veces - a.veces)[0];
  if (frecuente && frecuente.veces >= 8) {
    lista.push({ id: `comercio-${frecuente.clave}`, nivel: 'idea', titulo: `Vas mucho a ${frecuente.nombre}`, texto: `${frecuente.veces} veces este mes, ${pesos(frecuente.total)} en total (${pesos(Math.round(frecuente.total / frecuente.veces))} en promedio). Las compras chicas y seguidas suman rápido.` });
  }

  // 5) Suscripciones.
  const suscripciones = cambios.find((c) => c.nombre.toLowerCase() === 'suscripciones');
  if (suscripciones && suscripciones.actual >= 50_000) {
    lista.push({ id: 'suscripciones', nivel: 'idea', titulo: 'Revisa tus suscripciones', texto: `Este mes suman ${pesos(suscripciones.actual)}. Si alguna ya no la usas, cancelarla es ahorro seguro cada mes.`, categoria_id: suscripciones.categoria_id });
  }

  // 6) Apartados pendientes y metas sin dinero.
  if (d.pendientePorMover > 0) {
    lista.push({ id: 'por-mover', nivel: 'aviso', titulo: `Tienes ${pesos(d.pendientePorMover)} por apartar`, texto: 'Muévelos a tus apartados en el banco y márcalos como hechos para que tus metas avancen.' });
  }
  for (const m of d.metas.filter((x) => x.meta > 0 && x.aporte === 0 && !x.lograda).slice(0, 1)) {
    lista.push({ id: `meta-${m.nombre}`, nivel: 'aviso', titulo: `Tu meta "${m.nombre}" no recibe dinero`, texto: 'Ninguna de tus reglas de reparto le asigna un porcentaje. Dale uno en Apartados para que avance cada mes.' });
  }

  if (delMes.length === 0) {
    lista.push({ id: 'sin-gastos', nivel: 'idea', titulo: 'Aún no hay gastos este mes', texto: 'Cuando pagues con tus tarjetas aparecerán aquí solos y te diré cómo vas.' });
  }

  return lista.sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]).slice(0, max);
}
