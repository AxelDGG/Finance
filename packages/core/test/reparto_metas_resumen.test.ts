import { describe, expect, it } from 'vitest';
import {
  aporteMensual,
  escalaEje,
  gastosPorCategoria,
  porcentajeGastos,
  presupuestoDelMes,
  progresoMeta,
  proyeccionMeta,
  repartirIngreso,
  resumenMes,
  serieDias,
  serieMeses,
  serieSemanasMes,
} from '../src/index.ts';
import { config, mov } from './datos.ts';

const AHORA = new Date('2026-10-24T15:00:00-06:00');

describe('reparto', () => {
  it('reparte el ingreso principal 50/30/20 y dice qué mover', () => {
    const partes = repartirIngreso(1_200_000, 'f-principal', 'cta-sant', config());
    expect(partes.map((p) => [p.nombre, p.monto_centavos, p.requiereMover])).toEqual([
      ['Gastos personales', 600_000, true],
      ['Viaje', 360_000, true],
      ['Ahorro', 240_000, true],
    ]);
    expect(partes[0]!.descripcion).toBe('Pasar $6,000 a BBVA nómina');
    expect(partes[1]!.descripcion).toBe('Apartar $3,600 para Viaje');
  });

  it('el ingreso secundario se queda en BBVA sin moverse', () => {
    const partes = repartirIngreso(350_000, 'f-secundario', 'cta-bbva', config());
    expect(partes).toHaveLength(1);
    expect(partes[0]).toMatchObject({ tipo: 'gastos', monto_centavos: 350_000, requiereMover: false });
  });

  it('no pierde centavos al redondear', () => {
    const c = config();
    c.reglas = [{ fuente_id: 'f-principal', apartado_id: 'ap-viaje', porcentaje: 33.33 }];
    const partes = repartirIngreso(1_200_001, 'f-principal', 'cta-sant', c);
    expect(partes.reduce((a, p) => a + p.monto_centavos, 0)).toBe(1_200_001);
  });

  it('calcula porcentajes y aportes', () => {
    const c = config();
    expect(porcentajeGastos('f-principal', c.reglas, c.apartados)).toBe(50);
    expect(porcentajeGastos('f-secundario', c.reglas, c.apartados)).toBe(100);
    expect(aporteMensual('ap-viaje', c)).toBe(360_000);
    expect(aporteMensual('ap-gastos', c)).toBe(950_000);
  });
});

describe('metas', () => {
  const movs = [
    mov({ tipo: 'interno', apartado_id: 'ap-viaje', monto_centavos: 360_000, fecha: '2026-09-21T18:00:00Z' }),
    mov({ tipo: 'interno', apartado_id: 'ap-viaje', monto_centavos: 360_000, fecha: '2026-10-23T18:00:00Z' }),
    mov({ tipo: 'interno', apartado_id: 'ap-viaje', monto_centavos: 360_000, fecha: '2026-10-23T18:00:00Z', estado: 'descartado' }),
  ];

  it('suma saldo inicial más aportaciones confirmadas y estima la fecha', () => {
    const c = config();
    const viaje = c.apartados.find((a) => a.id === 'ap-viaje')!;
    const p = progresoMeta(viaje, movs, c, AHORA);
    expect(p.ahorrado).toBe(1_800_000);
    expect(p.progreso).toBeCloseTo(0.5);
    expect(p.falta).toBe(1_800_000);
    expect(p.meses).toBe(5);
    expect(p.periodoEstimado).toBe('2027-03');
    expect(p.textoEstimado).toBe('mar 2027');
  });

  it('sin aportación no promete fecha', () => {
    const c = config();
    c.reglas = [];
    const p = progresoMeta(c.apartados.find((a) => a.id === 'ap-ahorro')!, [], c, AHORA);
    expect(p.meses).toBeNull();
    expect(p.textoEstimado).toBe('Sin aportación mensual');
  });

  it('proyecta mes a mes hasta la meta', () => {
    const c = config();
    const puntos = proyeccionMeta(c.apartados.find((a) => a.id === 'ap-viaje')!, movs, c, AHORA);
    expect(puntos[0]).toMatchObject({ periodo: '2026-09', acumulado: 1_440_000, real: true });
    expect(puntos[1]).toMatchObject({ periodo: '2026-10', acumulado: 1_800_000, real: true });
    expect(puntos.at(-1)).toMatchObject({ periodo: '2027-03', acumulado: 3_600_000, real: false });
  });
});

describe('presupuesto y resumen', () => {
  const movs = [
    mov({ tipo: 'ingreso', fuente_id: 'f-principal', monto_centavos: 1_200_000, fecha: '2026-10-20T15:00:00Z' }),
    mov({ tipo: 'gasto', monto_centavos: 624_000, categoria_id: 'cat-Comida', fecha: '2026-10-10T15:00:00Z' }),
    mov({ tipo: 'gasto', monto_centavos: 5_000, categoria_id: 'cat-Comida', estado: 'por_revisar' }),
    mov({ tipo: 'interno', monto_centavos: 360_000 }),
  ];

  it('usa el ingreso real si ya llegó y el esperado si no', () => {
    const p = presupuestoDelMes(config(), movs);
    expect(p.porFuente.map((f) => [f.nombre, f.recibido, f.monto])).toEqual([
      ['Ingreso principal', true, 600_000],
      ['Ingreso secundario', false, 350_000],
    ]);
    expect(p.total).toBe(950_000);
  });

  it('calcula disponible, % usado y cuánto puedes gastar por día', () => {
    const r = resumenMes(movs, 950_000, AHORA);
    expect(r.gastado).toBe(624_000);
    expect(r.disponible).toBe(326_000);
    expect(Math.round(r.pctUsado)).toBe(66);
    expect(r.diasRestantes).toBe(7);
    expect(r.porDia).toBe(40_750); // 326,000 / 8 días (incluye hoy)
    expect(r.internos).toBe(360_000);
  });

  it('agrupa por categoría', () => {
    const c = config();
    const g = gastosPorCategoria(movs, c.categorias);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ nombre: 'Comida', monto: 624_000, pct: 100 });
  });

  it('arma series por día, semana y mes', () => {
    const gastos = [
      mov({ monto_centavos: 17_850, fecha: '2026-10-24T16:00:00Z' }),
      mov({ monto_centavos: 102_660, fecha: '2026-10-23T16:00:00Z' }),
      mov({ monto_centavos: 50_000, fecha: '2026-10-18T16:00:00Z' }),
      mov({ monto_centavos: 678_000, fecha: '2026-09-10T16:00:00Z' }),
    ];
    const dias = serieDias(gastos, AHORA, 7);
    expect(dias).toHaveLength(7);
    expect(dias[0]).toMatchObject({ corta: 'Dom', monto: 50_000 });
    expect(dias[6]).toMatchObject({ corta: 'Hoy', monto: 17_850, enCurso: true });

    const semanas = serieSemanasMes(gastos, '2026-10', AHORA);
    expect(semanas.map((s) => s.corta)).toEqual(['1–7', '8–14', '15–21', '22–24']);
    expect(semanas[3]).toMatchObject({ monto: 120_510, enCurso: true });

    const meses = serieMeses(gastos, AHORA, 6);
    expect(meses.map((m) => m.corta)).toEqual(['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct']);
    expect(meses[4]!.monto).toBe(678_000);
  });

  it('elige una escala de eje legible', () => {
    expect(escalaEje(102_660)).toEqual({ tope: 120_000, paso: 30_000 });
    expect(escalaEje(893_000)).toEqual({ tope: 1_000_000, paso: 250_000 });
  });
});
