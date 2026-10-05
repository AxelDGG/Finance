import { describe, expect, it } from 'vitest';
import { aporteMensual, encontrarFuente, montoPorDeposito, presupuestoDelMes } from '../src/index.ts';
import { config, mov } from './datos.ts';

// El ingreso principal de prueba es de $12,000 al mes; aquí llega en dos quincenas de $6,000.
const quincenal = () => {
  const c = config();
  c.fuentes = c.fuentes.map((f) => (f.id === 'f-principal' ? { ...f, frecuencia: 'quincenal' as const } : f));
  return c;
};

describe('ingresos quincenales', () => {
  it('cada depósito se compara contra la mitad del total del mes', () => {
    const c = quincenal();
    const principal = c.fuentes.find((f) => f.id === 'f-principal')!;
    expect(montoPorDeposito(principal)).toBe(600_000);
    expect(encontrarFuente(c.fuentes, 600_000, 'cta-sant', null)?.id).toBe('f-principal');
    // Un depósito del total del mes ya no se confunde con la quincena.
    expect(encontrarFuente(c.fuentes, 1_200_000, 'cta-sant', null)).toBeNull();
    // Mensual (la de siempre): $6,000 no es el ingreso de $12,000.
    expect(encontrarFuente(config().fuentes, 600_000, 'cta-sant', null)).toBeNull();
  });

  it('el presupuesto cuenta lo que ya llegó más las quincenas que faltan', () => {
    const c = quincenal();
    const sinNada = presupuestoDelMes(c, []).porFuente.find((f) => f.fuente_id === 'f-principal')!;
    expect(sinNada).toMatchObject({ base: 1_200_000, recibido: false });

    const una = presupuestoDelMes(c, [mov({ tipo: 'ingreso', fuente_id: 'f-principal', monto_centavos: 600_000 })]).porFuente.find((f) => f.fuente_id === 'f-principal')!;
    expect(una).toMatchObject({ base: 1_200_000, recibido: false });

    const dos = presupuestoDelMes(c, [
      mov({ tipo: 'ingreso', fuente_id: 'f-principal', monto_centavos: 600_000 }),
      mov({ tipo: 'ingreso', fuente_id: 'f-principal', monto_centavos: 610_000 }),
    ]).porFuente.find((f) => f.fuente_id === 'f-principal')!;
    expect(dos).toMatchObject({ base: 1_210_000, recibido: true, monto: 605_000 });
  });

  it('la aportación mensual a las metas usa el total del mes', () => {
    expect(aporteMensual('ap-viaje', quincenal())).toBe(360_000);
  });
});
