import type { ConfigUsuario, Movimiento } from '@finanzas/core';
import { formatoMXN } from '@finanzas/core';

export const NOMBRE_AVISO: Record<string, string> = { wallet: 'Google Wallet', bbva: 'BBVA', santander: 'Santander' };
const CORTO_AVISO: Record<string, string> = { wallet: 'Wallet', bbva: 'BBVA', santander: 'Santander' };

export const signo = (m: Movimiento) => (m.tipo === 'ingreso' ? '+' : m.tipo === 'gasto' ? '−' : '');
export const colorMonto = (m: Movimiento) => (m.tipo === 'ingreso' ? '#CFC8FF' : m.tipo === 'interno' ? '#8E919A' : '#EDEEF0');
export const montoConSigno = (m: Movimiento) => `${signo(m)}${formatoMXN(m.monto_centavos)}`;
export const pesos = (c: number) => formatoMXN(c, { decimales: 'nunca' });

export function nombreMovimiento(m: Movimiento, config: ConfigUsuario): string {
  if (m.comercio) return m.comercio;
  if (m.tipo === 'ingreso') return config.fuentes.find((f) => f.id === m.fuente_id)?.nombre ?? 'Ingreso';
  if (m.tipo === 'interno') return config.apartados.find((a) => a.id === m.apartado_id)?.nombre ?? 'Movimiento interno';
  if (m.avisos.includes('wallet')) return 'Pago con Google Wallet';
  return config.categorias.find((c) => c.id === m.categoria_id)?.nombre ?? 'Gasto';
}

export function etiquetaCategoria(m: Movimiento, config: ConfigUsuario): string {
  if (m.tipo === 'ingreso') return 'Ingreso';
  if (m.tipo === 'interno') return 'Interno';
  return config.categorias.find((c) => c.id === m.categoria_id)?.nombre ?? 'Sin categoría';
}

/** "Wallet + BBVA", "Santander", "Manual", "Importado". */
export function etiquetaOrigen(m: Movimiento, config: ConfigUsuario): string {
  if (m.avisos.length > 0) {
    return [...m.avisos]
      .sort((a, b) => (a === 'wallet' ? -1 : b === 'wallet' ? 1 : 0))
      .map((a) => CORTO_AVISO[a] ?? a)
      .join(' + ');
  }
  if (m.origen === 'importado') return 'Estado de cuenta';
  const cuenta = config.cuentas.find((c) => c.id === m.cuenta_id);
  return cuenta ? `${cuenta.alias} · manual` : 'Manual';
}

export function notaMovimiento(m: Movimiento): string {
  if (m.avisos.length > 1) return 'Llegaron 2 notificaciones del mismo pago y se juntaron en un solo movimiento.';
  if (m.tipo === 'interno') return 'Movimiento entre tus cuentas: se registra, pero no se descuenta de tus gastos.';
  if (m.tipo === 'ingreso') return 'Ingreso: se reparte con tus reglas de reparto.';
  if (m.avisos.length === 1 && m.avisos[0] === 'wallet') return 'Se registró desde Google Wallet. Cuando llegue el aviso del banco se juntará aquí.';
  if (m.avisos.length === 1) return 'Se registró desde la notificación del banco.';
  if (m.origen === 'importado') return 'Lo agregaste desde tu estado de cuenta.';
  return 'Lo registraste a mano.';
}

/** Iniciales para el avatar ("OXXO" → "O", "Uber Eats" → "UE"). */
export function iniciales(texto: string): string {
  const palabras = texto.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '·';
  if (palabras.length === 1) return palabras[0]!.slice(0, 1).toUpperCase();
  return (palabras[0]!.slice(0, 1) + palabras[1]!.slice(0, 1)).toUpperCase();
}

export const errorTexto = (e: unknown) => (e instanceof Error ? e.message : String(e));
