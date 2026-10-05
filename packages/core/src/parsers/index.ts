import type { Aviso, Banco, NotificacionEntrada } from '../tipos.ts';
import { limpiarComercio, normalizar } from '../texto.ts';
import {
  buscarComercio,
  buscarContraparte,
  buscarTerminacion,
  buscarTerminacionDestino,
  montoPrincipal,
} from './comun.ts';

export interface InfoApp {
  aviso: Aviso;
  banco: Banco | null;
  nombre: string;
}

/** Apps cuyas notificaciones escuchamos (nombre del paquete Android). */
export const APPS: Record<string, InfoApp> = {
  'com.bancomer.mbanking': { aviso: 'bbva', banco: 'BBVA', nombre: 'BBVA' },
  'mx.bancosantander.supermovil': { aviso: 'santander', banco: 'Santander', nombre: 'Santander' },
  'com.google.android.apps.walletnfcrel': { aviso: 'wallet', banco: null, nombre: 'Google Wallet' },
};

/**
 * Para pruebas en el emulador: `adb shell cmd notification post` publica como
 * com.android.shell. Un título "[BBVA] ..." se trata como si viniera de BBVA.
 */
export const APP_PRUEBAS = 'com.android.shell';
const PREFIJO_PRUEBA = /^\s*\[(bbva|santander|wallet)\]\s*/i;
const APP_POR_PREFIJO: Record<string, string> = {
  bbva: 'com.bancomer.mbanking',
  santander: 'mx.bancosantander.supermovil',
  wallet: 'com.google.android.apps.walletnfcrel',
};

export function resolverApp(app: string, titulo: string | null | undefined): { app: string; titulo: string } {
  const t = titulo ?? '';
  if (app === APP_PRUEBAS) {
    const m = t.match(PREFIJO_PRUEBA);
    const destino = m?.[1] ? APP_POR_PREFIJO[m[1].toLowerCase()] : undefined;
    if (destino) return { app: destino, titulo: t.replace(PREFIJO_PRUEBA, '') };
  }
  return { app, titulo: t };
}

export type TipoEvento =
  | 'compra'
  | 'retiro'
  | 'transferencia_enviada'
  | 'transferencia_recibida'
  | 'ignorar'
  | 'desconocido';

export interface EventoParseado {
  /** Qué app avisó. */
  aviso: Aviso;
  /** Banco de la cuenta afectada, si se sabe. */
  banco: Banco | null;
  tipo: TipoEvento;
  monto_centavos: number | null;
  /** Comercio (compras) o contraparte (transferencias). */
  comercio: string | null;
  /** Últimos 4 dígitos de tu tarjeta/cuenta. */
  terminacion: string | null;
  /** En transferencias: últimos 4 de la cuenta destino. */
  terminacion_destino: string | null;
  /** 0 a 1: qué tan seguros estamos de la lectura. */
  confianza: number;
  motivo: string | null;
  /** ms desde epoch */
  fecha: number;
}

// Las expresiones se aplican al texto normalizado (minúsculas, sin acentos).
/** Android 15+ reemplaza el texto si cree que trae un código. */
const OCULTA = /(sensitive notification content hidden|contenido.{0,30}(sensible|confidencial).{0,20}ocult|contenido oculto)/;

const RECHAZO = /(rechazad|declinad|no (fue|pudo ser|ha sido) (aprobad|autorizad|procesad|realizad)|no se (realizo|pudo|completo)|fallid|fondos insuficientes|saldo insuficiente|no autorizad|cancelad)/;
const SEGURIDAD = /(codigo|clave|token|nip|contrasena|otp|password)\b.{0,40}\b(seguridad|verificacion|dinamic|acceso|operacion|un solo uso|confirmacion)|tu (codigo|clave|token) (es|de)|(inicio de sesion|iniciaste sesion|nuevo dispositivo|ingresaste a (tu|la) app|acceso a tu (app|banca|cuenta))/;
const PUBLICIDAD = /(promocion|oferta|aprovecha|descuento|participa|sorteo|gana |meses sin intereses|cashback|beneficio|invitacion|conoce|descarga|actualiza tu app|te invitamos)/;
const INFORMATIVO = /(estado de cuenta|tu saldo (es|actual|disponible)|consulta de saldo|fecha (limite|de corte)|recordatorio de pago|tu pago (vence|esta por vencer)|pago minimo)/;

const RECIBIDA = /(recibiste|te (enviaron|depositaron|transfirieron|pagaron|llego|llegaron)|(transferencia|spei|deposito|abono|pago|envio) (de dinero )?recibid|se (acredito|abono|deposito)|abono (a|en) tu|deposito (a|en) tu|depositaron|ingreso (de|a tu cuenta|recibido)|recibimos (un|tu) (deposito|pago))/;
const ENVIADA = /(enviaste|transferiste|traspasaste|(transferencia|spei|envio|traspaso)( de dinero)? (enviad|realizad|exitos|aplicad|programad)|realizaste (una |un )?(transferencia|spei|envio|traspaso)|traspaso (a|entre)|envio de dinero|enviamos tu|pagaste a |spei enviado|transferencia (a |por )|transferencia interbancaria|retiro por transferencia)/;
const RETIRO = /(retiro|retiraste|disposicion de efectivo|cajero automatico|cajero)/;
const COMPRA = /(compra|compraste|pagaste|pago (con|en|de|por|realizado|aprobado|exitoso|autorizado)|cargo|consumo|cobro|domiciliacion|se realizo un pago|cobramos|autorizamos|aprobamos|usaste tu tarjeta|tu tarjeta (fue usada|se uso|se utilizo)|pago a comercio)/;

const TITULOS_GENERICOS_WALLET = /^(google ?wallet|google ?pay|wallet|pago (realizado|completado|exitoso|aprobado)|compra (realizada|aprobada)|pagaste|tu pago|pago con (tu )?(telefono|celular|reloj)|transaccion)$/;

function bancoEnTexto(textoNorm: string): Banco | null {
  if (/\bbbva\b|bancomer/.test(textoNorm)) return 'BBVA';
  if (/santander/.test(textoNorm)) return 'Santander';
  return null;
}

/**
 * Convierte una notificación en un evento bancario.
 * Devuelve null si la app no es una de las que escuchamos.
 */
export function parsearNotificacion(entrada: NotificacionEntrada): EventoParseado | null {
  const { app, titulo } = resolverApp(entrada.app, entrada.titulo);
  const info = APPS[app];
  if (!info) return null;

  const cuerpo = (entrada.texto_grande && entrada.texto_grande.trim()) || entrada.texto || '';
  const completo = `${titulo}\n${cuerpo}`.trim();
  const norm = normalizar(completo);

  const base: EventoParseado = {
    aviso: info.aviso,
    banco: info.banco ?? bancoEnTexto(norm),
    tipo: 'desconocido',
    monto_centavos: null,
    comercio: null,
    terminacion: buscarTerminacion(completo),
    terminacion_destino: null,
    confianza: 0,
    motivo: null,
    fecha: entrada.publicada_en,
  };

  const monto = montoPrincipal(completo);
  base.monto_centavos = monto?.centavos ?? null;

  if (OCULTA.test(norm)) {
    return { ...base, tipo: 'desconocido', motivo: 'Android ocultó el contenido de este aviso (protegido)', confianza: 0 };
  }
  if (RECHAZO.test(norm)) return { ...base, tipo: 'ignorar', motivo: 'Operación rechazada o no realizada', confianza: 0.9 };
  if (SEGURIDAD.test(norm)) return { ...base, tipo: 'ignorar', motivo: 'Aviso de seguridad o código', confianza: 0.9 };

  const esRecibida = RECIBIDA.test(norm);
  const esEnviada = !esRecibida && ENVIADA.test(norm);
  const esRetiro = !esRecibida && !esEnviada && RETIRO.test(norm);
  const esCompra = !esRecibida && !esEnviada && !esRetiro && COMPRA.test(norm);
  const hayMovimiento = esRecibida || esEnviada || esRetiro || esCompra;

  if (!hayMovimiento && (PUBLICIDAD.test(norm) || INFORMATIVO.test(norm))) {
    return { ...base, tipo: 'ignorar', motivo: 'Publicidad o aviso informativo', confianza: 0.8 };
  }
  if (!monto) {
    return { ...base, tipo: hayMovimiento ? 'desconocido' : 'ignorar', motivo: hayMovimiento ? 'No se encontró el monto' : 'Sin monto ni movimiento', confianza: hayMovimiento ? 0.2 : 0.6 };
  }

  const confianza = monto.conMoneda ? 0.9 : 0.7;

  // Google Wallet solo avisa de pagos; el título suele ser el comercio.
  if (info.aviso === 'wallet') {
    const tituloNorm = normalizar(titulo);
    const comercio = titulo && !TITULOS_GENERICOS_WALLET.test(tituloNorm) && !/\$|\d+[.,]\d{2}\b/.test(titulo)
      ? titulo
      : buscarComercio(cuerpo) ?? buscarComercio(completo);
    return { ...base, tipo: 'compra', comercio: limpiarComercio(comercio), confianza: esRecibida ? 0.4 : confianza };
  }

  if (esRecibida) {
    return {
      ...base,
      tipo: 'transferencia_recibida',
      comercio: limpiarComercio(buscarContraparte(completo, 'recibida')),
      confianza,
    };
  }
  if (esEnviada) {
    return {
      ...base,
      tipo: 'transferencia_enviada',
      comercio: limpiarComercio(buscarContraparte(completo, 'enviada')),
      terminacion_destino: buscarTerminacionDestino(completo),
      confianza,
    };
  }
  if (esRetiro) {
    return { ...base, tipo: 'retiro', comercio: 'Retiro de efectivo', confianza };
  }
  if (esCompra) {
    return { ...base, tipo: 'compra', comercio: limpiarComercio(buscarComercio(completo)), confianza };
  }
  return { ...base, tipo: 'desconocido', motivo: 'Hay un monto pero no se reconoce el tipo de movimiento', confianza: 0.3 };
}
