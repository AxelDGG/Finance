import { formatoMXN, nombrePeriodo } from '@finanzas/core';

/** Sirve para saber si ya se propuso el sobrante de ese mes. */
export const prefijoSobrante = (periodo: string) => `Sobrante de ${nombrePeriodo(periodo, true)}`;

/** "Sobrante de septiembre 2026: apartar $1,881.26 para Viaje". */
export const descripcionSobrante = (periodo: string, monto: number, meta: string) => `${prefijoSobrante(periodo)}: apartar ${formatoMXN(monto)} para ${meta}`;
