// Fechas en la zona horaria de la Ciudad de México.

export const ZONA = 'America/Mexico_City';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export interface PartesFecha {
  anio: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number; // 0 = domingo
}

const formateador = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  weekday: 'short',
  hourCycle: 'h23',
});

const DIA_INGLES: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function partes(fecha: Date | string | number): PartesFecha {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const p: Record<string, string> = {};
  for (const parte of formateador.formatToParts(d)) p[parte.type] = parte.value;
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    diaSemana: DIA_INGLES[p.weekday ?? 'Sun'] ?? 0,
  };
}

const dos = (n: number) => String(n).padStart(2, '0');

/** "2026-10" */
export function periodoDe(fecha: Date | string | number): string {
  const p = partes(fecha);
  return `${p.anio}-${dos(p.mes)}`;
}

/** "2026-10-24" */
export function claveDia(fecha: Date | string | number): string {
  const p = partes(fecha);
  return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`;
}

export function sumarMeses(periodo: string, n: number): string {
  const [a, m] = periodo.split('-').map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${dos((total % 12) + 1)}`;
}

/** Diferencia en minutos entre la hora local de CDMX y UTC para ese instante. */
function desfaseMinutos(instante: Date): number {
  const p = partes(instante);
  const comoUTC = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
  return Math.round((comoUTC - Math.floor(instante.getTime() / 60000) * 60000) / 60000);
}

/** Instante UTC que corresponde a una fecha/hora local de CDMX. */
export function desdeLocal(anio: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
  const aproximado = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto));
  return new Date(aproximado.getTime() - desfaseMinutos(aproximado) * 60000);
}

/** Inicio (incluido) y fin (excluido) de un mes "AAAA-MM" en CDMX. */
export function rangoPeriodo(periodo: string): { desde: Date; hasta: Date } {
  const [a, m] = periodo.split('-').map(Number) as [number, number];
  const siguiente = sumarMeses(periodo, 1).split('-').map(Number) as [number, number];
  return { desde: desdeLocal(a, m, 1), hasta: desdeLocal(siguiente[0], siguiente[1], 1) };
}

export function diasEnMes(periodo: string): number {
  const [a, m] = periodo.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Días que faltan para terminar el mes, sin contar hoy. */
export function diasRestantesMes(ahora: Date | string | number = new Date()): number {
  const p = partes(ahora);
  return diasEnMes(`${p.anio}-${dos(p.mes)}`) - p.dia;
}

/** "oct 2026" */
export function nombrePeriodo(periodo: string, largo = false): string {
  const [a, m] = periodo.split('-').map(Number) as [number, number];
  return `${(largo ? MESES_LARGOS : MESES)[m - 1]} ${a}`;
}

export function nombreMes(mes: number, largo = false): string {
  return (largo ? MESES_LARGOS : MESES)[(mes - 1 + 12) % 12] ?? '';
}

export function nombreDia(diaSemana: number, largo = false): string {
  return (largo ? DIAS_LARGOS : DIAS)[diaSemana] ?? '';
}

/** "14:32" */
export function hora(fecha: Date | string | number): string {
  const p = partes(fecha);
  return `${dos(p.hora)}:${dos(p.minuto)}`;
}

/** "Hoy", "Ayer", "Jue 22 oct" o "22 oct 2025" si es de otro año. */
export function etiquetaDia(fecha: Date | string | number, ahora: Date | string | number = new Date()): string {
  const clave = claveDia(fecha);
  if (clave === claveDia(ahora)) return 'Hoy';
  const ayer = new Date((ahora instanceof Date ? ahora : new Date(ahora)).getTime() - 86400000);
  if (clave === claveDia(ayer)) return 'Ayer';
  const p = partes(fecha);
  const base = `${nombreDia(p.diaSemana)} ${p.dia} ${MESES[p.mes - 1]}`;
  return p.anio === partes(ahora).anio ? base : `${p.dia} ${MESES[p.mes - 1]} ${p.anio}`;
}
