import type { Categoria, ConfigUsuario, Movimiento } from './tipos.ts';
import { claveDia, diasEnMes, diasRestantesMes, nombreDia, nombrePeriodo, partes, periodoDe, sumarMeses } from './fechas.ts';
import { porcentajeGastos } from './reparto.ts';

export const confirmado = (m: Movimiento) => m.estado === 'confirmado';
export const esGasto = (m: Movimiento) => m.tipo === 'gasto' && confirmado(m);
export const esIngreso = (m: Movimiento) => m.tipo === 'ingreso' && confirmado(m);

const suma = (movs: Movimiento[]) => movs.reduce((acc, m) => acc + m.monto_centavos, 0);

export interface PresupuestoFuente {
  fuente_id: string;
  nombre: string;
  /** Monto recibido este mes, o el esperado si aún no llega. */
  base: number;
  recibido: boolean;
  porcentaje: number;
  monto: number;
}

export interface Presupuesto {
  total: number;
  porFuente: PresupuestoFuente[];
  /** Ingresos que no son de ninguna fuente (van completos a gastos). */
  extras: number;
}

/**
 * Cuánto tienes para gastar este mes: lo que le toca a Gastos personales
 * de cada fuente (real si ya llegó, esperado si no) más ingresos extra.
 */
export function presupuestoDelMes(config: Pick<ConfigUsuario, 'fuentes' | 'reglas' | 'apartados'>, movimientosMes: Movimiento[]): Presupuesto {
  const ingresos = movimientosMes.filter(esIngreso);
  const porFuente = config.fuentes
    .filter((f) => f.activo)
    .map((f) => {
      const recibido = suma(ingresos.filter((m) => m.fuente_id === f.id));
      const base = recibido > 0 ? recibido : f.monto_esperado_centavos;
      const porcentaje = porcentajeGastos(f.id, config.reglas, config.apartados);
      return { fuente_id: f.id, nombre: f.nombre, base, recibido: recibido > 0, porcentaje, monto: Math.round((base * porcentaje) / 100) };
    });
  const idsFuentes = new Set(config.fuentes.map((f) => f.id));
  const extras = suma(ingresos.filter((m) => !m.fuente_id || !idsFuentes.has(m.fuente_id)));
  return { total: porFuente.reduce((a, f) => a + f.monto, 0) + extras, porFuente, extras };
}

export interface ResumenMes {
  presupuesto: number;
  gastado: number;
  disponible: number;
  /** 0 a 100 */
  pctUsado: number;
  diasRestantes: number;
  /** Cuánto puedes gastar por día lo que resta del mes (incluye hoy). */
  porDia: number;
  ingresos: number;
  internos: number;
}

export function resumenMes(movimientosMes: Movimiento[], presupuesto: number, ahora: Date = new Date()): ResumenMes {
  const gastado = suma(movimientosMes.filter(esGasto));
  const disponible = presupuesto - gastado;
  const diasRestantes = diasRestantesMes(ahora);
  return {
    presupuesto,
    gastado,
    disponible,
    pctUsado: presupuesto > 0 ? Math.min(100, (gastado / presupuesto) * 100) : gastado > 0 ? 100 : 0,
    diasRestantes,
    porDia: disponible > 0 ? Math.floor(disponible / (diasRestantes + 1)) : 0,
    ingresos: suma(movimientosMes.filter(esIngreso)),
    internos: suma(movimientosMes.filter((m) => m.tipo === 'interno' && confirmado(m))),
  };
}

export interface GastoCategoria {
  categoria_id: string | null;
  nombre: string;
  color: string;
  monto: number;
  cantidad: number;
  /** 0 a 100 */
  pct: number;
}

export function gastosPorCategoria(movimientos: Movimiento[], categorias: Categoria[]): GastoCategoria[] {
  const gastos = movimientos.filter(esGasto);
  const total = suma(gastos);
  const grupos = new Map<string | null, Movimiento[]>();
  for (const m of gastos) {
    const k = categorias.some((c) => c.id === m.categoria_id) ? m.categoria_id : null;
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  }
  return [...grupos.entries()]
    .map(([id, movs]) => {
      const cat = categorias.find((c) => c.id === id);
      const monto = suma(movs);
      return {
        categoria_id: id,
        nombre: cat?.nombre ?? 'Sin categoría',
        color: cat?.color ?? '#34363D',
        monto,
        cantidad: movs.length,
        pct: total > 0 ? (monto / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.monto - a.monto);
}

export interface PuntoSerie {
  clave: string;
  /** Etiqueta larga para el tooltip. */
  etiqueta: string;
  /** Etiqueta corta para el eje. */
  corta: string;
  monto: number;
  cantidad: number;
  enCurso: boolean;
}

/** Gasto por día de los últimos `n` días (incluye hoy). */
export function serieDias(movimientos: Movimiento[], ahora: Date = new Date(), n = 7): PuntoSerie[] {
  const gastos = movimientos.filter(esGasto);
  const puntos: PuntoSerie[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dia = new Date(ahora.getTime() - i * 86400000);
    const clave = claveDia(dia);
    const p = partes(dia);
    const delDia = gastos.filter((m) => claveDia(m.fecha) === clave);
    puntos.push({
      clave,
      etiqueta: `${nombreDia(p.diaSemana)} ${p.dia} ${nombrePeriodo(periodoDe(dia)).split(' ')[0]}${i === 0 ? ' · hoy' : ''}`,
      corta: i === 0 ? 'Hoy' : nombreDia(p.diaSemana),
      monto: suma(delDia),
      cantidad: delDia.length,
      enCurso: i === 0,
    });
  }
  return puntos;
}

/** Gasto por semana (1–7, 8–14, …) de un mes. */
export function serieSemanasMes(movimientos: Movimiento[], periodo: string, ahora: Date = new Date()): PuntoSerie[] {
  const gastos = movimientos.filter((m) => esGasto(m) && periodoDe(m.fecha) === periodo);
  const total = diasEnMes(periodo);
  const hoy = periodoDe(ahora) === periodo ? partes(ahora).dia : total;
  const mes = nombrePeriodo(periodo).split(' ')[0];
  const puntos: PuntoSerie[] = [];
  for (let inicio = 1; inicio <= Math.min(total, hoy); inicio += 7) {
    const fin = Math.min(inicio + 6, total);
    const enCurso = hoy >= inicio && hoy <= fin && periodoDe(ahora) === periodo;
    const finVisible = enCurso ? hoy : fin;
    const semana = gastos.filter((m) => {
      const d = partes(m.fecha).dia;
      return d >= inicio && d <= fin;
    });
    puntos.push({
      clave: `${periodo}-s${inicio}`,
      etiqueta: `${inicio} – ${finVisible} ${mes}${enCurso ? ' · en curso' : ''}`,
      corta: `${inicio}–${finVisible}`,
      monto: suma(semana),
      cantidad: semana.length,
      enCurso,
    });
  }
  return puntos;
}

/** Gasto total por mes de los últimos `n` meses. */
export function serieMeses(movimientos: Movimiento[], ahora: Date = new Date(), n = 6): PuntoSerie[] {
  const actual = periodoDe(ahora);
  const gastos = movimientos.filter(esGasto);
  const puntos: PuntoSerie[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const periodo = sumarMeses(actual, -i);
    const delMes = gastos.filter((m) => periodoDe(m.fecha) === periodo);
    const nombre = nombrePeriodo(periodo, true).split(' ')[0] ?? '';
    puntos.push({
      clave: periodo,
      etiqueta: `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}${i === 0 ? ' · en curso' : ''}`,
      corta: (nombrePeriodo(periodo).split(' ')[0] ?? '').replace(/^./, (c) => c.toUpperCase()),
      monto: suma(delMes),
      cantidad: delMes.length,
      enCurso: i === 0,
    });
  }
  return puntos;
}

/** Escala "bonita" para el eje Y de una gráfica de barras (4 divisiones). */
export function escalaEje(maximo: number, divisiones = 4): { tope: number; paso: number } {
  if (maximo <= 0) return { tope: divisiones * 10000, paso: 10000 };
  const objetivo = maximo / divisiones;
  const potencia = Math.pow(10, Math.floor(Math.log10(objetivo)));
  const factor = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((f) => f * potencia >= objetivo) ?? 10;
  const paso = factor * potencia;
  return { tope: paso * divisiones, paso };
}
