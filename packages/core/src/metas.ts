import type { Apartado, ConfigUsuario, Movimiento } from './tipos.ts';
import { nombrePeriodo, periodoDe, sumarMeses } from './fechas.ts';
import { porcentajeDe } from './reparto.ts';

/** Cuánto le llega a un apartado cada mes según tus reglas e ingresos esperados. */
export function aporteMensual(apartadoId: string, config: Pick<ConfigUsuario, 'fuentes' | 'reglas' | 'apartados'>): number {
  return config.fuentes
    .filter((f) => f.activo)
    .reduce((acc, f) => acc + Math.round((f.monto_esperado_centavos * porcentajeDe(f.id, apartadoId, config.reglas, config.apartados)) / 100), 0);
}

/** Aportaciones confirmadas a un apartado (movimientos internos hacia él). */
export function aportaciones(apartado: Apartado, movimientos: Movimiento[]): Movimiento[] {
  return movimientos.filter((m) => m.apartado_id === apartado.id && m.tipo === 'interno' && m.estado === 'confirmado');
}

export function ahorradoEn(apartado: Apartado, movimientos: Movimiento[]): number {
  return apartado.saldo_inicial_centavos + aportaciones(apartado, movimientos).reduce((a, m) => a + m.monto_centavos, 0);
}

export interface ProgresoMeta {
  ahorrado: number;
  meta: number;
  /** 0 a 1 */
  progreso: number;
  falta: number;
  aporte: number;
  /** Meses que faltan con el aporte actual (null si no hay aporte). */
  meses: number | null;
  /** "2027-07" */
  periodoEstimado: string | null;
  /** "jul 2027", "¡Lograda!" o "Sin aportación mensual" */
  textoEstimado: string;
  lograda: boolean;
}

export function progresoMeta(
  apartado: Apartado,
  movimientos: Movimiento[],
  config: Pick<ConfigUsuario, 'fuentes' | 'reglas' | 'apartados'>,
  ahora: Date = new Date(),
): ProgresoMeta {
  const ahorrado = ahorradoEn(apartado, movimientos);
  const meta = apartado.meta_centavos ?? 0;
  const aporte = aporteMensual(apartado.id, config);
  const falta = Math.max(0, meta - ahorrado);
  const lograda = meta > 0 && falta === 0;
  const meses = lograda ? 0 : aporte > 0 && meta > 0 ? Math.ceil(falta / aporte) : null;
  const periodoEstimado = meses != null ? sumarMeses(periodoDe(ahora), meses) : null;
  return {
    ahorrado,
    meta,
    progreso: meta > 0 ? Math.min(1, ahorrado / meta) : 0,
    falta,
    aporte,
    meses,
    periodoEstimado,
    textoEstimado: lograda ? '¡Lograda!' : periodoEstimado ? nombrePeriodo(periodoEstimado) : meta > 0 ? 'Sin aportación mensual' : 'Sin meta',
    lograda,
  };
}

export interface PuntoProyeccion {
  periodo: string;
  etiqueta: string;
  acumulado: number;
  real: boolean;
}

/**
 * Historia real (acumulado al cierre de cada mes) y proyección hasta
 * llegar a la meta. Como máximo 60 meses hacia adelante.
 */
export function proyeccionMeta(
  apartado: Apartado,
  movimientos: Movimiento[],
  config: Pick<ConfigUsuario, 'fuentes' | 'reglas' | 'apartados'>,
  ahora: Date = new Date(),
): PuntoProyeccion[] {
  const actual = periodoDe(ahora);
  const aport = aportaciones(apartado, movimientos);
  const primero = aport.map((m) => periodoDe(m.fecha)).sort()[0] ?? actual;
  const puntos: PuntoProyeccion[] = [];
  let acumulado = apartado.saldo_inicial_centavos;
  for (let p = primero; p <= actual; p = sumarMeses(p, 1)) {
    acumulado += aport.filter((m) => periodoDe(m.fecha) === p).reduce((a, m) => a + m.monto_centavos, 0);
    puntos.push({ periodo: p, etiqueta: nombrePeriodo(p), acumulado, real: true });
  }
  const meta = apartado.meta_centavos ?? 0;
  const aporte = aporteMensual(apartado.id, config);
  let p = actual;
  for (let i = 0; i < 60 && meta > 0 && aporte > 0 && acumulado < meta; i++) {
    p = sumarMeses(p, 1);
    acumulado = Math.min(meta, acumulado + aporte);
    puntos.push({ periodo: p, etiqueta: nombrePeriodo(p), acumulado, real: false });
  }
  return puntos;
}
