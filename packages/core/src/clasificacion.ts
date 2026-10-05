import type { EventoParseado } from './parsers/index.ts';
import type { Aviso, ConfigUsuario, Cuenta, EstadoNotificacion, FuenteIngreso, TipoMovimiento } from './tipos.ts';
import { categoriaPorNombre, sugerirCategoria } from './categorias.ts';
import { normalizar, normalizarComercio } from './texto.ts';

/** Movimiento listo para guardarse (sin id). */
export interface MovimientoPropuesto {
  fecha: string;
  monto_centavos: number;
  tipo: TipoMovimiento;
  comercio: string | null;
  cuenta_id: string | null;
  categoria_id: string | null;
  apartado_id: string | null;
  fuente_id: string | null;
  avisos: Aviso[];
  terminacion: string | null;
  estado: 'confirmado' | 'por_revisar';
}

export interface ResultadoClasificacion {
  movimiento: MovimientoPropuesto | null;
  estadoNotificacion: Exclude<EstadoNotificacion, 'pendiente' | 'error'>;
  motivo: string | null;
}

/** Encuentra tu cuenta por terminación o, si solo tienes una de ese banco, por banco. */
export function encontrarCuenta(cuentas: Cuenta[], terminacion: string | null, banco: string | null): Cuenta | null {
  if (terminacion) {
    const porTerminacion = cuentas.find((c) => c.terminaciones.includes(terminacion));
    if (porTerminacion) return porTerminacion;
  }
  if (banco) {
    const delBanco = cuentas.filter((c) => c.banco === banco);
    if (delBanco.length === 1) return delBanco[0] ?? null;
    const principal = delBanco.find((c) => c.es_principal);
    if (principal) return principal;
  }
  return null;
}

/** ¿El texto de una transferencia apunta a una de tus cuentas o apartados? */
function destinoPropio(evento: EventoParseado, config: ConfigUsuario): { cuenta: Cuenta | null; apartadoId: string | null } | null {
  if (evento.terminacion_destino) {
    const cuenta = config.cuentas.find((c) => c.terminaciones.includes(evento.terminacion_destino!));
    if (cuenta) {
      const apartadoDeCuenta = config.apartados.find((a) => a.cuenta_id === cuenta.id && !a.archivado);
      return { cuenta, apartadoId: apartadoDeCuenta?.id ?? null };
    }
  }
  const contraparte = normalizarComercio(evento.comercio);
  if (contraparte) {
    const apartado = config.apartados.find((a) => !a.archivado && contraparte.includes(normalizarComercio(a.nombre)));
    if (apartado) return { cuenta: null, apartadoId: apartado.id };
    const cuenta = config.cuentas.find((c) => {
      const alias = normalizarComercio(c.alias);
      return alias.length >= 3 && contraparte.includes(alias);
    });
    if (cuenta) return { cuenta, apartadoId: null };
  }
  return null;
}

/** Fuente de ingreso que mejor coincide con un depósito recibido. */
export function encontrarFuente(
  fuentes: FuenteIngreso[],
  monto: number,
  cuentaId: string | null,
  textoContraparte: string | null,
): FuenteIngreso | null {
  const contraparte = normalizar(textoContraparte ?? '');
  const candidatas = fuentes
    .filter((f) => f.activo)
    .filter((f) => !f.cuenta_id || !cuentaId || f.cuenta_id === cuentaId)
    .filter((f) => Math.abs(monto - f.monto_esperado_centavos) <= (f.monto_esperado_centavos * f.tolerancia_pct) / 100)
    .filter((f) => f.palabras_clave.length === 0 || f.palabras_clave.some((p) => contraparte.includes(normalizar(p))));
  candidatas.sort(
    (a, b) => Math.abs(monto - a.monto_esperado_centavos) / a.monto_esperado_centavos - Math.abs(monto - b.monto_esperado_centavos) / b.monto_esperado_centavos,
  );
  return candidatas[0] ?? null;
}

/** Decide qué movimiento representa un evento, usando tu configuración. */
export function clasificar(evento: EventoParseado, config: ConfigUsuario): ResultadoClasificacion {
  if (evento.tipo === 'ignorar') {
    return { movimiento: null, estadoNotificacion: 'ignorada', motivo: evento.motivo };
  }
  if (evento.tipo === 'desconocido' || evento.monto_centavos == null) {
    return { movimiento: null, estadoNotificacion: 'por_revisar', motivo: evento.motivo ?? 'No se pudo interpretar' };
  }

  const cuenta = encontrarCuenta(config.cuentas, evento.terminacion, evento.banco);
  const gastos = config.apartados.find((a) => a.tipo === 'gastos') ?? null;
  const base: MovimientoPropuesto = {
    fecha: new Date(evento.fecha).toISOString(),
    monto_centavos: evento.monto_centavos,
    tipo: 'gasto',
    comercio: evento.comercio,
    cuenta_id: cuenta?.id ?? null,
    categoria_id: null,
    apartado_id: null,
    fuente_id: null,
    avisos: [evento.aviso],
    terminacion: evento.terminacion,
    estado: 'confirmado',
  };

  switch (evento.tipo) {
    case 'compra':
    case 'retiro': {
      const categoria =
        evento.tipo === 'retiro'
          ? categoriaPorNombre(config.categorias, 'Otros')
          : sugerirCategoria(evento.comercio, config.reglasCategoria, config.categorias);
      return {
        movimiento: { ...base, tipo: 'gasto', apartado_id: gastos?.id ?? null, categoria_id: categoria },
        estadoNotificacion: 'procesada',
        motivo: null,
      };
    }
    case 'transferencia_enviada': {
      const destino = destinoPropio(evento, config);
      if (destino) {
        const apartadoId = destino.apartadoId ?? (destino.cuenta && gastos?.cuenta_id === destino.cuenta.id ? gastos.id : null);
        return {
          movimiento: { ...base, tipo: 'interno', apartado_id: apartadoId },
          estadoNotificacion: 'procesada',
          motivo: null,
        };
      }
      return {
        movimiento: {
          ...base,
          tipo: 'gasto',
          apartado_id: gastos?.id ?? null,
          categoria_id: categoriaPorNombre(config.categorias, 'Transferencias'),
        },
        estadoNotificacion: 'procesada',
        motivo: null,
      };
    }
    case 'transferencia_recibida': {
      const contraparte = normalizarComercio(evento.comercio);
      const deCuentaPropia =
        (evento.terminacion_destino && config.cuentas.some((c) => c.terminaciones.includes(evento.terminacion_destino!))) ||
        (contraparte.length >= 3 && config.cuentas.some((c) => contraparte.includes(normalizarComercio(c.alias))));
      if (deCuentaPropia) {
        return { movimiento: { ...base, tipo: 'interno' }, estadoNotificacion: 'procesada', motivo: null };
      }
      const fuente = encontrarFuente(config.fuentes, evento.monto_centavos, cuenta?.id ?? null, evento.comercio);
      return {
        movimiento: {
          ...base,
          tipo: 'ingreso',
          fuente_id: fuente?.id ?? null,
          cuenta_id: base.cuenta_id ?? fuente?.cuenta_id ?? null,
        },
        estadoNotificacion: 'procesada',
        motivo: null,
      };
    }
  }
  return { movimiento: null, estadoNotificacion: 'por_revisar', motivo: 'Tipo de movimiento no soportado' };
}
