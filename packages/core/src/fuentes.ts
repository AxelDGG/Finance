import type { FuenteIngreso } from './tipos.ts';

/** Cuántos depósitos llegan al mes de una fuente. */
export function depositosPorMes(f: Pick<FuenteIngreso, 'frecuencia'>): number {
  return f.frecuencia === 'quincenal' ? 2 : 1;
}

/** Monto esperado de cada depósito (con quincenal, la mitad del total del mes). */
export function montoPorDeposito(f: Pick<FuenteIngreso, 'frecuencia' | 'monto_esperado_centavos'>): number {
  return Math.round(f.monto_esperado_centavos / depositosPorMes(f));
}
