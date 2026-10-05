import type { Aviso, Movimiento } from './tipos.ts';
import type { MovimientoPropuesto } from './clasificacion.ts';
import type { TipoEvento } from './parsers/index.ts';
import { normalizarComercio } from './texto.ts';

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** Ventana en la que buscamos candidatos para juntar con un movimiento nuevo. */
export const VENTANA_BUSQUEDA_MS = 72 * HORA;

export interface Fusion {
  movimientoId: string;
  /** Campos a actualizar en el movimiento existente. Vacío = era un aviso repetido. */
  cambios: Partial<Pick<Movimiento, 'tipo' | 'comercio' | 'cuenta_id' | 'categoria_id' | 'fuente_id' | 'apartado_id' | 'terminacion' | 'fecha' | 'estado'>> & { avisos?: string[] };
  razon: 'wallet_y_banco' | 'repetida' | 'confirma_manual' | 'traspaso_entre_cuentas';
}

const BANCOS: Aviso[] = ['bbva', 'santander'];

function esTransferencia(evento: TipoEvento | undefined): boolean {
  return evento === 'transferencia_enviada' || evento === 'transferencia_recibida';
}

/**
 * Decide si un movimiento recién leído es en realidad el mismo que uno ya
 * guardado (otro aviso del mismo pago, una captura manual, o el otro lado
 * de un traspaso entre tus cuentas).
 */
export function buscarFusion(
  propuesto: MovimientoPropuesto,
  evento: TipoEvento | undefined,
  candidatos: Movimiento[],
): Fusion | null {
  const aviso = propuesto.avisos[0];
  const tProp = Date.parse(propuesto.fecha);
  const opciones: Array<{ c: Movimiento; dt: number; razon: Fusion['razon']; prioridad: number }> = [];

  for (const c of candidatos) {
    if (c.estado === 'descartado' || c.monto_centavos !== propuesto.monto_centavos) continue;
    const dt = Math.abs(Date.parse(c.fecha) - tProp);
    const avisosC = c.avisos as Aviso[];

    // 1) Aviso repetido de la misma app (Android a veces publica dos veces).
    if (aviso && avisosC.includes(aviso) && dt <= 3 * MINUTO && c.tipo === propuesto.tipo) {
      const a = normalizarComercio(c.comercio);
      const b = normalizarComercio(propuesto.comercio);
      if (!a || !b || a === b) opciones.push({ c, dt, razon: 'repetida', prioridad: 0 });
      continue;
    }

    // 2) Pago con Google Wallet: llega el aviso de Wallet y el del banco.
    if (
      aviso &&
      c.tipo === 'gasto' &&
      propuesto.tipo === 'gasto' &&
      dt <= 15 * MINUTO &&
      avisosC.length > 0 &&
      !avisosC.includes(aviso)
    ) {
      const union = new Set<string>([...avisosC, aviso]);
      const bancosEnUnion = [...union].filter((x) => BANCOS.includes(x as Aviso)).length;
      if (union.has('wallet') && bancosEnUnion <= 1) {
        opciones.push({ c, dt, razon: 'wallet_y_banco', prioridad: 1 });
        continue;
      }
    }

    // 3) Ya lo habías capturado a mano (o marcaste un "por mover" como hecho).
    if (c.origen === 'manual' && avisosC.length === 0) {
      const ventana = c.tipo === 'interno' ? 72 * HORA : 48 * HORA;
      const compatible = c.tipo === propuesto.tipo || (c.tipo === 'interno' && esTransferencia(evento));
      if (dt <= ventana && compatible) {
        opciones.push({ c, dt, razon: 'confirma_manual', prioridad: 2 });
        continue;
      }
    }

    // 4) Traspaso entre tus cuentas: sale de un banco y entra al otro.
    //    El lado que sale pudo quedar como gasto/interno y el que entra
    //    como ingreso sin fuente/interno; juntos son un movimiento interno.
    if (
      aviso &&
      aviso !== 'wallet' &&
      dt <= 60 * MINUTO &&
      avisosC.length > 0 &&
      !avisosC.includes(aviso) &&
      !avisosC.includes('wallet') &&
      esTransferencia(evento)
    ) {
      const otroLadoEsEntrada = c.tipo === 'interno' || (c.tipo === 'ingreso' && !c.fuente_id);
      const otroLadoEsSalida = c.tipo === 'interno' || c.tipo === 'gasto';
      const encaja = evento === 'transferencia_enviada' ? otroLadoEsEntrada : otroLadoEsSalida && !propuesto.fuente_id;
      if (encaja) opciones.push({ c, dt, razon: 'traspaso_entre_cuentas', prioridad: 3 });
    }
  }

  opciones.sort((a, b) => a.prioridad - b.prioridad || a.dt - b.dt);
  const elegida = opciones[0];
  if (!elegida) return null;
  const { c, razon } = elegida;

  if (razon === 'repetida') return { movimientoId: c.id, cambios: {}, razon };

  const avisos = [...new Set([...c.avisos, ...propuesto.avisos])];
  const fecha = Date.parse(c.fecha) <= tProp ? c.fecha : propuesto.fecha;

  if (razon === 'traspaso_entre_cuentas') {
    return {
      movimientoId: c.id,
      razon,
      cambios: { tipo: 'interno', avisos, fuente_id: null, categoria_id: null, apartado_id: c.apartado_id ?? propuesto.apartado_id, fecha, estado: 'confirmado' },
    };
  }

  const vieneDeWallet = aviso === 'wallet';
  const cambios: Fusion['cambios'] = {
    avisos,
    fecha,
    estado: 'confirmado',
    comercio: vieneDeWallet ? propuesto.comercio ?? c.comercio : c.comercio ?? propuesto.comercio,
    cuenta_id: vieneDeWallet ? c.cuenta_id ?? propuesto.cuenta_id : propuesto.cuenta_id ?? c.cuenta_id,
    terminacion: vieneDeWallet ? c.terminacion ?? propuesto.terminacion : propuesto.terminacion ?? c.terminacion,
    categoria_id: c.categoria_id ?? propuesto.categoria_id,
  };
  if (razon === 'confirma_manual' && c.tipo === 'interno') {
    cambios.comercio = c.comercio ?? propuesto.comercio;
  }
  return { movimientoId: c.id, cambios, razon };
}
