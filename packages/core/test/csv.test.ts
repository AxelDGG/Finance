import { describe, expect, it } from 'vitest';
import { conciliar, detectarColumnas, exportarCSV, filasDeEstado, leerCSV, leerFecha, ubicarEncabezado } from '../src/index.ts';
import { config, mov } from './datos.ts';

describe('CSV', () => {
  it('lee comas, punto y coma y comillas', () => {
    expect(leerCSV('a,b,c\n1,"x, y",3\n')).toEqual([['a', 'b', 'c'], ['1', 'x, y', '3']]);
    expect(leerCSV('Fecha;Concepto;Importe\r\n24/10/2026;OXXO;-86,50')).toEqual([['Fecha', 'Concepto', 'Importe'], ['24/10/2026', 'OXXO', '-86,50']]);
    expect(leerCSV('﻿a,"b ""c"""')).toEqual([['a', 'b "c"']]);
  });

  it('exporta con BOM, signo y nombres', () => {
    const c = config();
    const csv = exportarCSV([mov({ comercio: 'OXXO, centro', monto_centavos: 8650, categoria_id: 'cat-Súper', cuenta_id: 'cta-bbva', avisos: ['wallet', 'bbva'] })], c.categorias, c.cuentas);
    expect(csv.startsWith('﻿Fecha,Hora,Tipo')).toBe(true);
    expect(csv).toContain('"OXXO, centro",Súper,BBVA nómina,-86.50,notificacion,wallet+bbva');
  });

  it('neutraliza fórmulas en el texto exportado (CSV injection)', () => {
    const c = config();
    const csv = exportarCSV(
      [mov({ comercio: '=HYPERLINK("http://x","clic")', descripcion: '@SUM(A1)', monto_centavos: 100, fecha: '2026-10-24T20:00:00Z' })],
      c.categorias,
      c.cuentas,
    );
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""clic"")"`);
    expect(csv).toContain("'@SUM(A1)");
    // Los montos negativos siguen siendo números.
    expect(csv).toContain(',-1.00,');
  });

  it('detecta columnas de BBVA (cargo/abono) y de un formato con monto único', () => {
    expect(detectarColumnas(['Fecha', 'Descripción', 'Cargo', 'Abono', 'Saldo'])).toEqual({ fecha: 0, descripcion: 1, monto: null, cargo: 2, abono: 3 });
    expect(detectarColumnas(['FECHA', 'CONCEPTO', 'IMPORTE'])).toEqual({ fecha: 0, descripcion: 1, monto: 2, cargo: null, abono: null });
    expect(detectarColumnas(['x', 'y'])).toBeNull();
  });

  it('salta los renglones de título hasta el encabezado', () => {
    const filas = leerCSV(['BBVA México', 'Cuenta: ****1234', '', 'Fecha,Concepto,Cargo,Abono,Saldo', '01/10/2026,OXXO,50.00,,1000.00'].join('\n'));
    expect(ubicarEncabezado(filas)).toEqual({ indice: 2, columnas: { fecha: 0, descripcion: 1, monto: null, cargo: 2, abono: 3 } });
    expect(ubicarEncabezado([['hola']])).toBeNull();
  });

  it('lee fechas en varios formatos', () => {
    expect(leerFecha('24/10/2026')?.toISOString()).toBe('2026-10-24T18:00:00.000Z');
    expect(leerFecha('2026-10-24')?.toISOString()).toBe('2026-10-24T18:00:00.000Z');
    expect(leerFecha('24-oct-2026')?.toISOString()).toBe('2026-10-24T18:00:00.000Z');
    expect(leerFecha('ayer')).toBeNull();
  });

  it('concilia: encuentra lo registrado y reporta lo que falta', () => {
    const filas = filasDeEstado(
      leerCSV('Fecha,Descripción,Cargo,Abono\n24/10/2026,OXXO GDL,86.50,\n25/10/2026,FARMACIA,120.00,\n20/10/2026,SPEI EMPRESA,,"12,000.00"').slice(1),
      { fecha: 0, descripcion: 1, monto: null, cargo: 2, abono: 3 },
    );
    expect(filas.map((f) => f.monto)).toEqual([-8650, -12000, 1200000]);
    const movs = [
      mov({ id: 'a', monto_centavos: 8650, fecha: '2026-10-24T20:00:00Z', cuenta_id: 'cta-bbva' }),
      mov({ id: 'b', tipo: 'ingreso', monto_centavos: 1200000, fecha: '2026-10-20T15:00:00Z', cuenta_id: 'cta-bbva' }),
    ];
    const r = conciliar(filas, movs, 'cta-bbva');
    expect(r.encontradas.map((e) => e.movimiento.id).sort()).toEqual(['a', 'b']);
    expect(r.faltantes).toHaveLength(1);
    expect(r.faltantes[0]).toMatchObject({ descripcion: 'FARMACIA', monto: -12000 });
  });
});
