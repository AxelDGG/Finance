import { describe, expect, it } from 'vitest';
import { compararCategorias, gastosPorCategoriaMeses, recomendaciones, topComercios } from '../src/index.ts';
import { config, mov } from './datos.ts';

const AHORA = new Date('2026-10-24T15:00:00-06:00'); // día 24 de un mes de 31
const c = config();
const gasto = (monto: number, fecha: string, categoria: string, comercio: string | null = null) =>
  mov({ tipo: 'gasto', monto_centavos: monto, fecha, categoria_id: `cat-${categoria}`, comercio });

describe('comparar categorías', () => {
  it('compara contra el mes pasado hasta el mismo día', () => {
    const movs = [
      gasto(60_000, '2026-10-10T18:00:00Z', 'Comida'),
      gasto(40_000, '2026-10-20T18:00:00Z', 'Comida'),
      gasto(50_000, '2026-09-10T18:00:00Z', 'Comida'),
      gasto(90_000, '2026-09-28T18:00:00Z', 'Comida'), // después del día 24: no cuenta
      gasto(30_000, '2026-09-05T18:00:00Z', 'Súper'),
    ];
    const r = compararCategorias(movs, c.categorias, AHORA);
    expect(r[0]).toMatchObject({ nombre: 'Comida', actual: 100_000, anterior: 50_000, cambioPct: 100 });
    expect(r.find((x) => x.nombre === 'Súper')).toMatchObject({ actual: 0, anterior: 30_000, cambioPct: -100 });
  });
});

describe('comercios', () => {
  it('junta variantes del mismo comercio y usa el nombre más común', () => {
    const movs = [
      gasto(5_000, '2026-10-01T18:00:00Z', 'Súper', 'OXXO'),
      gasto(7_000, '2026-10-02T18:00:00Z', 'Súper', 'OXXO'),
      gasto(3_000, '2026-10-03T18:00:00Z', 'Súper', 'Oxxo'),
      gasto(20_000, '2026-10-04T18:00:00Z', 'Comida', 'Starbucks'),
      gasto(99_000, '2026-09-04T18:00:00Z', 'Comida', 'Starbucks'), // otro mes
    ];
    expect(topComercios(movs, '2026-10')).toEqual([
      { clave: 'starbucks', nombre: 'Starbucks', veces: 1, total: 20_000 },
      { clave: 'oxxo', nombre: 'OXXO', veces: 3, total: 15_000 },
    ]);
  });
});

describe('gasto por categoría y mes', () => {
  it('apila las categorías más grandes y junta el resto en "Otras"', () => {
    const nombres = ['Comida', 'Súper', 'Transporte', 'Salud', 'Hogar', 'Compras'];
    const movs = nombres.map((n, i) => gasto((6 - i) * 10_000, '2026-10-05T18:00:00Z', n));
    movs.push(gasto(5_000, '2026-08-05T18:00:00Z', 'Comida'));
    const r = gastosPorCategoriaMeses(movs, c.categorias, AHORA, 6, 5);
    expect(r.series.map((s) => s.nombre)).toEqual(['Comida', 'Súper', 'Transporte', 'Salud', 'Otras']);
    expect(r.series.at(-1)!.total).toBe(30_000); // Hogar + Compras
    expect(r.meses.map((m) => m.corta)).toEqual(['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct']);
    const octubre = r.meses.at(-1)!;
    expect(octubre).toMatchObject({ enCurso: true, total: 210_000 });
    expect(Object.values(octubre.montos).reduce((a, b) => a + b, 0)).toBe(210_000);
    expect(r.meses[3]!.total).toBe(5_000);
  });
});

describe('recomendaciones', () => {
  const base = { categorias: c.categorias, presupuesto: 900_000, metas: [], pendientePorMover: 0, ahora: AHORA };

  it('avisa si a este ritmo te vas a pasar y dice cuánto gastar por día', () => {
    const r = recomendaciones({ ...base, movimientos: [gasto(800_000, '2026-10-12T18:00:00Z', 'Compras')] });
    expect(r[0]).toMatchObject({ id: 'ritmo-alto', nivel: 'alerta' });
    // $8,000 en 24 días → $10,333 al cierre; quedan $1,000 para 8 días.
    expect(r[0]!.texto).toContain('$10,333');
    expect(r[0]!.texto).toContain('$125 al día');
  });

  it('dice cuando ya te pasaste', () => {
    const r = recomendaciones({ ...base, movimientos: [gasto(950_000, '2026-10-12T18:00:00Z', 'Compras')] });
    expect(r[0]).toMatchObject({ id: 'excedido', nivel: 'alerta', titulo: 'Te pasaste del presupuesto' });
  });

  it('felicita si vas por debajo del ritmo', () => {
    const r = recomendaciones({ ...base, movimientos: [gasto(300_000, '2026-10-12T18:00:00Z', 'Compras')] });
    expect(r.map((x) => x.id)).toContain('ritmo-bien');
    // $3,000 en 24 días → $3,875 al cierre; sobrarían $5,125 de $9,000.
    expect(r.find((x) => x.id === 'ritmo-bien')!.texto).toContain('$5,125');
  });

  it('señala la categoría que más creció y lo pendiente por apartar', () => {
    const movs = [gasto(100_000, '2026-10-10T18:00:00Z', 'Comida'), gasto(50_000, '2026-09-10T18:00:00Z', 'Comida'), gasto(150_000, '2026-10-11T18:00:00Z', 'Compras')];
    const r = recomendaciones({ ...base, movimientos: movs, pendientePorMover: 360_000, metas: [{ nombre: 'Viaje', meta: 3_600_000, aporte: 0, lograda: false }] });
    expect(r.find((x) => x.id === 'sube-cat-Comida')).toMatchObject({ nivel: 'aviso', titulo: 'Gastas más en Comida' });
    expect(r.find((x) => x.id === 'sube-cat-Comida')!.texto).toContain('100 % más');
    expect(r.find((x) => x.id === 'por-mover')!.titulo).toBe('Tienes $3,600 por apartar');
    expect(r.find((x) => x.id === 'meta-Viaje')!.titulo).toContain('no recibe dinero');
    // Las alertas van antes que los avisos y las buenas noticias al final.
    const niveles = r.map((x) => x.nivel);
    expect(niveles).toEqual([...niveles].sort((a, b) => ['alerta', 'aviso', 'idea', 'bien'].indexOf(a) - ['alerta', 'aviso', 'idea', 'bien'].indexOf(b)));
  });

  it('detecta un comercio al que vas muy seguido', () => {
    const movs = Array.from({ length: 9 }, (_, i) => gasto(6_000, `2026-10-${String(i + 1).padStart(2, '0')}T18:00:00Z`, 'Súper', 'OXXO'));
    const r = recomendaciones({ ...base, movimientos: movs });
    expect(r.find((x) => x.id === 'comercio-oxxo')).toMatchObject({ titulo: 'Vas mucho a OXXO' });
  });

  it('sin gastos lo dice', () => {
    expect(recomendaciones({ ...base, movimientos: [] }).map((x) => x.id)).toEqual(['sin-gastos']);
  });
});
