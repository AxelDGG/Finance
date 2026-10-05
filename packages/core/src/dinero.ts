// Dinero en centavos enteros: nunca sumamos decimales flotantes.

export function aCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function aPesos(centavos: number): number {
  return centavos / 100;
}

/**
 * Lee un monto escrito al estilo México ("1,234.56", "$ 1,234", "250.5")
 * y lo devuelve en centavos. Si no es un monto válido devuelve null.
 */
export function leerMonto(texto: string): number | null {
  const limpio = texto.replace(/[$\s]|MXN|M\.?N\.?/gi, '');
  if (!/^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const [enteros = '0', decimales = ''] = limpio.replace(/,/g, '').split('.');
  const centavos = Number(enteros) * 100 + Number((decimales + '00').slice(0, 2));
  return Number.isFinite(centavos) && centavos > 0 ? centavos : null;
}

export interface OpcionesFormato {
  /** 'auto': muestra centavos solo si los hay. */
  decimales?: 'auto' | 'siempre' | 'nunca';
  /** Antepone + o − según el signo. */
  signo?: boolean;
}

const formatoEntero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const formatoDecimal = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function formatoMXN(centavos: number, opciones: OpcionesFormato = {}): string {
  const { decimales = 'auto', signo = false } = opciones;
  const absoluto = Math.abs(centavos);
  const conDecimales = decimales === 'siempre' || (decimales === 'auto' && absoluto % 100 !== 0);
  const numero = conDecimales
    ? formatoDecimal.format(absoluto / 100)
    : formatoEntero.format(decimales === 'nunca' ? Math.round(absoluto / 100) : Math.floor(absoluto / 100));
  const prefijo = signo ? (centavos > 0 ? '+' : centavos < 0 ? '−' : '') : centavos < 0 ? '−' : '';
  return `${prefijo}$${numero}`;
}

/** "$1.2k", "$950": para ejes de gráficas. */
export function formatoCorto(centavos: number): string {
  const pesos = Math.round(centavos / 100);
  if (Math.abs(pesos) >= 1000) {
    const miles = Math.round(pesos / 100) / 10;
    return `$${miles.toLocaleString('es-MX', { maximumFractionDigits: 1 })}k`;
  }
  return `$${pesos}`;
}
