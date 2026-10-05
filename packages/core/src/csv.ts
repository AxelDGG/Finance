// Exportar movimientos a CSV e importar estados de cuenta para conciliar
// (encontrar lo que no llegó por notificación).
import type { Categoria, Cuenta, Movimiento } from './tipos.ts';
import { leerMonto } from './dinero.ts';
import { claveDia, desdeLocal, hora } from './fechas.ts';
import { normalizar } from './texto.ts';

/** Lee CSV (coma, punto y coma o tabulador; comillas dobles). */
export function leerCSV(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '');
  const primera = limpio.split(/\r?\n/, 1)[0] ?? '';
  const separador = [',', ';', '\t'].map((s) => ({ s, n: primera.split(s).length })).sort((a, b) => b.n - a.n)[0]?.s ?? ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]!;
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === separador) {
      fila.push(campo.trim());
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo.trim());
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  fila.push(campo.trim());
  if (fila.some((x) => x !== '')) filas.push(fila);
  return filas;
}

function celda(valor: string | number | null | undefined): string {
  const t = valor == null ? '' : String(valor);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/**
 * Texto que viene de afuera (comercios, notas): si empieza con = + - @ Excel
 * lo ejecutaría como fórmula ("CSV injection"). Se antepone un apóstrofo.
 */
function texto(valor: string | null | undefined): string {
  const t = valor ?? '';
  return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
}

/** CSV con todos los movimientos, listo para Excel o Google Sheets. */
export function exportarCSV(movimientos: Movimiento[], categorias: Categoria[], cuentas: Cuenta[]): string {
  const encabezado = ['Fecha', 'Hora', 'Tipo', 'Comercio', 'Categoría', 'Cuenta', 'Monto', 'Origen', 'Avisos', 'Nota'];
  const filas = [...movimientos]
    .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
    .map((m) => [
      claveDia(m.fecha),
      hora(m.fecha),
      m.tipo,
      texto(m.comercio),
      texto(categorias.find((c) => c.id === m.categoria_id)?.nombre),
      texto(cuentas.find((c) => c.id === m.cuenta_id)?.alias),
      ((m.tipo === 'gasto' ? -1 : 1) * m.monto_centavos / 100).toFixed(2),
      m.origen,
      m.avisos.join('+'),
      texto(m.descripcion),
    ]);
  // BOM para que Excel abra los acentos bien.
  return '﻿' + [encabezado, ...filas].map((f) => f.map(celda).join(',')).join('\r\n');
}

export interface Columnas {
  fecha: number;
  descripcion: number;
  /** Columna única con signo (negativo = cargo). */
  monto: number | null;
  cargo: number | null;
  abono: number | null;
}

/** Adivina qué columna es cuál a partir del encabezado (BBVA, Santander y genéricos). */
export function detectarColumnas(encabezado: string[]): Columnas | null {
  const n = encabezado.map((h) => normalizar(h));
  const buscar = (re: RegExp) => n.findIndex((h) => re.test(h));
  const fecha = buscar(/fecha|date|dia/);
  const descripcion = buscar(/descripcion|concepto|detalle|movimiento|referencia|comercio|description/);
  const cargo = buscar(/cargo|retiro|debito|egreso|salida/);
  const abono = buscar(/abono|deposito|credito|ingreso|entrada/);
  const monto = buscar(/^(monto|importe|cantidad|amount)$|monto|importe/);
  if (fecha < 0 || descripcion < 0) return null;
  if (cargo >= 0 || abono >= 0) return { fecha, descripcion, monto: null, cargo: cargo >= 0 ? cargo : null, abono: abono >= 0 ? abono : null };
  if (monto >= 0) return { fecha, descripcion, monto, cargo: null, abono: null };
  return null;
}

/** Los estados de cuenta traen renglones de título antes del encabezado: lo buscamos. */
export function ubicarEncabezado(filas: string[][], maximo = 25): { indice: number; columnas: Columnas } | null {
  for (let i = 0; i < Math.min(filas.length, maximo); i++) {
    const columnas = detectarColumnas(filas[i]!);
    if (columnas) return { indice: i, columnas };
  }
  return null;
}

/** "24/10/2026", "2026-10-24", "24-oct-2026" → Date (mediodía CDMX). */
export function leerFecha(texto: string): Date | null {
  const t = normalizar(texto);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return desdeLocal(Number(m[1]), Number(m[2]), Number(m[3]), 12);
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    const anio = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return desdeLocal(anio, Number(m[2]), Number(m[1]), 12);
  }
  m = t.match(/^(\d{1,2})[-/ ]([a-z]{3})[a-z]*[-/ ](\d{2,4})/);
  if (m) {
    const mes = meses.indexOf(m[2]!) + 1;
    const anio = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    if (mes > 0) return desdeLocal(anio, mes, Number(m[1]), 12);
  }
  return null;
}

export interface FilaEstado {
  fecha: Date;
  descripcion: string;
  /** Centavos; negativo = cargo, positivo = abono. */
  monto: number;
}

function montoCelda(texto: string | undefined): number | null {
  if (!texto) return null;
  const negativo = /^\s*-|\(.*\)/.test(texto);
  const centavos = leerMonto(texto.replace(/[()-]/g, '').trim());
  return centavos == null ? null : negativo ? -centavos : centavos;
}

export function filasDeEstado(filas: string[][], columnas: Columnas): FilaEstado[] {
  const salida: FilaEstado[] = [];
  for (const f of filas) {
    const fecha = leerFecha(f[columnas.fecha] ?? '');
    if (!fecha) continue;
    let monto: number | null = null;
    if (columnas.monto != null) monto = montoCelda(f[columnas.monto]);
    else {
      const cargo = columnas.cargo != null ? montoCelda(f[columnas.cargo]) : null;
      const abono = columnas.abono != null ? montoCelda(f[columnas.abono]) : null;
      if (cargo) monto = -Math.abs(cargo);
      else if (abono) monto = Math.abs(abono);
    }
    if (!monto) continue;
    salida.push({ fecha, descripcion: (f[columnas.descripcion] ?? '').trim(), monto });
  }
  return salida;
}

export interface Conciliacion {
  /** Están en el estado de cuenta pero no en la app. */
  faltantes: FilaEstado[];
  /** Ya estaban registrados. */
  encontradas: Array<{ fila: FilaEstado; movimiento: Movimiento }>;
}

/**
 * Compara el estado de cuenta contra tus movimientos de esa cuenta: mismo
 * monto y fecha cercana (los bancos a veces aplican un día después).
 */
export function conciliar(filas: FilaEstado[], movimientos: Movimiento[], cuentaId: string | null, diasTolerancia = 3): Conciliacion {
  const disponibles = movimientos.filter((m) => m.estado !== 'descartado' && (!cuentaId || !m.cuenta_id || m.cuenta_id === cuentaId));
  const usados = new Set<string>();
  const faltantes: FilaEstado[] = [];
  const encontradas: Conciliacion['encontradas'] = [];
  const ventana = diasTolerancia * 86400000;
  for (const fila of filas) {
    const esCargo = fila.monto < 0;
    const candidato = disponibles
      .filter((m) => !usados.has(m.id) && m.monto_centavos === Math.abs(fila.monto))
      .filter((m) => (esCargo ? m.tipo !== 'ingreso' : m.tipo !== 'gasto'))
      .filter((m) => Math.abs(Date.parse(m.fecha) - fila.fecha.getTime()) <= ventana)
      .sort((a, b) => Math.abs(Date.parse(a.fecha) - fila.fecha.getTime()) - Math.abs(Date.parse(b.fecha) - fila.fecha.getTime()))[0];
    if (candidato) {
      usados.add(candidato.id);
      encontradas.push({ fila, movimiento: candidato });
    } else faltantes.push(fila);
  }
  return { faltantes, encontradas };
}
