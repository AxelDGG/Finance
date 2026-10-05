import { describe, expect, it } from 'vitest';
import {
  claveDia,
  diasRestantesMes,
  etiquetaDia,
  formatoCorto,
  formatoMXN,
  leerMonto,
  limpiarComercio,
  normalizarComercio,
  periodoDe,
  rangoPeriodo,
  sumarMeses,
} from '../src/index.ts';

describe('dinero', () => {
  it('lee montos al estilo México', () => {
    expect(leerMonto('1,234.56')).toBe(123456);
    expect(leerMonto('$ 86.50')).toBe(8650);
    expect(leerMonto('12,000')).toBe(1200000);
    expect(leerMonto('250.5')).toBe(25050);
    expect(leerMonto('1234')).toBe(123400);
    expect(leerMonto('abc')).toBeNull();
    expect(leerMonto('0.00')).toBeNull();
  });

  it('da formato en pesos', () => {
    expect(formatoMXN(123456)).toBe('$1,234.56');
    expect(formatoMXN(1200000)).toBe('$12,000');
    expect(formatoMXN(8650, { signo: true })).toBe('+$86.50');
    expect(formatoMXN(-8650, { signo: true })).toBe('−$86.50');
    expect(formatoMXN(100, { decimales: 'siempre' })).toBe('$1.00');
    expect(formatoCorto(120000)).toBe('$1.2k');
    expect(formatoCorto(90000)).toBe('$900');
  });
});

describe('texto', () => {
  it('normaliza comercios igual que la función SQL', () => {
    // Mismos casos que se probaron contra public.normalizar_comercio()
    expect(normalizarComercio('Café OXXO #123 Ñandú-Sur')).toBe('cafe oxxo nandu sur');
    expect(normalizarComercio('  DiDi  Food*MX ')).toBe('didi food mx');
    expect(normalizarComercio(null)).toBe('');
  });

  it('limpia nombres de comercio', () => {
    expect(limpiarComercio('PAYPAL *SPOTIFY')).toBe('SPOTIFY');
    expect(limpiarComercio('OXXO GUADALUPE 1234')).toBe('OXXO GUADALUPE');
    expect(limpiarComercio('MERPAGO*TIENDITA')).toBe('TIENDITA');
    expect(limpiarComercio('  ')).toBeNull();
  });
});

describe('fechas (Ciudad de México)', () => {
  it('usa la hora local para el periodo y el día', () => {
    // 1 de nov 03:00 UTC = 31 de oct 21:00 en CDMX
    expect(periodoDe('2026-11-01T03:00:00Z')).toBe('2026-10');
    expect(claveDia('2026-11-01T03:00:00Z')).toBe('2026-10-31');
  });

  it('calcula los límites del mes', () => {
    const { desde, hasta } = rangoPeriodo('2026-10');
    expect(desde.toISOString()).toBe('2026-10-01T06:00:00.000Z');
    expect(hasta.toISOString()).toBe('2026-11-01T06:00:00.000Z');
    expect(sumarMeses('2026-10', 9)).toBe('2027-07');
    expect(sumarMeses('2026-01', -1)).toBe('2025-12');
  });

  it('cuenta los días que faltan y pone etiquetas', () => {
    const ahora = new Date('2026-10-24T18:00:00-06:00');
    expect(diasRestantesMes(ahora)).toBe(7);
    expect(etiquetaDia('2026-10-24T09:00:00-06:00', ahora)).toBe('Hoy');
    expect(etiquetaDia('2026-10-23T09:00:00-06:00', ahora)).toBe('Ayer');
    expect(etiquetaDia('2026-10-22T09:00:00-06:00', ahora)).toBe('Jue 22 oct');
  });
});
