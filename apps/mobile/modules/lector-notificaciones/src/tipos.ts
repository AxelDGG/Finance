export interface EstadoLector {
  /** Permiso de "Acceso a notificaciones" concedido. */
  permiso: boolean;
  /** La app está exenta del ahorro de batería. */
  sinRestriccionBateria: boolean;
  /** Puede mostrar sus propios avisos (Android 13+ pide permiso). */
  puedeAvisar: boolean;
  /** Ya tiene URL y llave para enviar. */
  configurado: boolean;
  pendientes: number;
  enviadas: number;
  ultimaCaptura: number | null;
  ultimoEnvio: number | null;
  ultimoError: string | null;
  /** Android 15+: ya se permitió leer avisos que el sistema marca como protegidos. */
  puedeLeerProtegidas: boolean;
  /** Avisos del banco que Android ocultó. */
  ocultas: number;
  ultimaOculta: number | null;
  paquete: string;
  fabricante: string;
  modelo: string;
  android: number;
}

export interface CapturaLocal {
  id: number;
  app: string;
  titulo: string | null;
  texto: string | null;
  publicadaEn: number;
  estado: 'pendiente' | 'enviada' | 'error';
  resultado: string | null;
}

export type EventosLector = {
  onCaptura(evento: { app: string; titulo: string; publicadaEn: number }): void;
  onEnvio(evento: { ok: boolean; enviadas?: number; error?: string | null }): void;
};
