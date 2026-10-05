import type { Apartado, ConfigUsuario, ReglaReparto } from './tipos.ts';
import { formatoMXN } from './dinero.ts';

export interface ParteReparto {
  apartado_id: string;
  nombre: string;
  tipo: 'gastos' | 'meta';
  porcentaje: number;
  monto_centavos: number;
  /** true si hay que mover el dinero a otra cuenta o apartado. */
  requiereMover: boolean;
  descripcion: string;
}

function metasActivas(apartados: Apartado[]): Apartado[] {
  return apartados.filter((a) => a.tipo === 'meta' && !a.archivado);
}

/** % de una fuente que va a metas (el resto es para Gastos personales). */
export function porcentajeMetas(fuenteId: string, reglas: ReglaReparto[], apartados: Apartado[]): number {
  const metas = new Set(metasActivas(apartados).map((a) => a.id));
  return reglas
    .filter((r) => r.fuente_id === fuenteId && metas.has(r.apartado_id))
    .reduce((acc, r) => acc + Number(r.porcentaje), 0);
}

export function porcentajeGastos(fuenteId: string, reglas: ReglaReparto[], apartados: Apartado[]): number {
  return Math.max(0, 100 - porcentajeMetas(fuenteId, reglas, apartados));
}

/** % de una fuente que va a un apartado concreto. */
export function porcentajeDe(fuenteId: string, apartadoId: string, reglas: ReglaReparto[], apartados: Apartado[]): number {
  const apartado = apartados.find((a) => a.id === apartadoId);
  if (!apartado) return 0;
  if (apartado.tipo === 'gastos') return porcentajeGastos(fuenteId, reglas, apartados);
  return Number(reglas.find((r) => r.fuente_id === fuenteId && r.apartado_id === apartadoId)?.porcentaje ?? 0);
}

/**
 * Reparte un ingreso según las reglas de su fuente. Sin fuente, todo va
 * a Gastos personales. Los centavos de redondeo se quedan en Gastos.
 */
export function repartirIngreso(
  monto: number,
  fuenteId: string | null,
  cuentaIngresoId: string | null,
  config: Pick<ConfigUsuario, 'reglas' | 'apartados' | 'cuentas'>,
): ParteReparto[] {
  const partes: ParteReparto[] = [];
  let asignado = 0;

  if (fuenteId) {
    for (const meta of metasActivas(config.apartados).sort((a, b) => a.orden - b.orden)) {
      const pct = Number(config.reglas.find((r) => r.fuente_id === fuenteId && r.apartado_id === meta.id)?.porcentaje ?? 0);
      if (pct <= 0) continue;
      const parte = Math.round((monto * pct) / 100);
      asignado += parte;
      partes.push({
        apartado_id: meta.id,
        nombre: meta.nombre,
        tipo: 'meta',
        porcentaje: pct,
        monto_centavos: parte,
        requiereMover: true,
        descripcion: `Apartar ${formatoMXN(parte)} para ${meta.nombre}`,
      });
    }
  }

  const gastos = config.apartados.find((a) => a.tipo === 'gastos');
  const resto = monto - asignado;
  if (gastos && resto > 0) {
    const cuentaGastos = config.cuentas.find((c) => c.id === gastos.cuenta_id);
    const requiereMover = !!gastos.cuenta_id && !!cuentaIngresoId && gastos.cuenta_id !== cuentaIngresoId;
    partes.unshift({
      apartado_id: gastos.id,
      nombre: gastos.nombre,
      tipo: 'gastos',
      porcentaje: Math.round((resto / monto) * 10000) / 100,
      monto_centavos: resto,
      requiereMover,
      descripcion: requiereMover
        ? `Pasar ${formatoMXN(resto)} a ${cuentaGastos?.alias ?? cuentaGastos?.banco ?? 'tu cuenta de gastos'}`
        : `${formatoMXN(resto)} se quedan para gastar`,
    });
  }
  return partes;
}
