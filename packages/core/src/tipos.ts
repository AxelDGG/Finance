// Tipos compartidos por la app Android, la web/escritorio y la función de ingesta.
// Reflejan las tablas de supabase/migrations. Todo el dinero va en centavos.

export type Banco = 'BBVA' | 'Santander' | 'Otro';
export type TipoMovimiento = 'gasto' | 'ingreso' | 'interno';
export type OrigenMovimiento = 'notificacion' | 'manual' | 'importado';
export type EstadoMovimiento = 'confirmado' | 'por_revisar' | 'descartado';
export type EstadoNotificacion = 'pendiente' | 'procesada' | 'ignorada' | 'por_revisar' | 'error';
/** Qué app avisó de un movimiento. */
export type Aviso = 'wallet' | 'bbva' | 'santander';

export interface Cuenta {
  id: string;
  banco: Banco;
  alias: string;
  terminaciones: string[];
  es_principal: boolean;
}

export interface Apartado {
  id: string;
  nombre: string;
  tipo: 'gastos' | 'meta';
  descripcion: string | null;
  cuenta_id: string | null;
  destino: string | null;
  meta_centavos: number | null;
  saldo_inicial_centavos: number;
  color: string;
  orden: number;
  archivado: boolean;
}

export interface FuenteIngreso {
  id: string;
  nombre: string;
  cuenta_id: string | null;
  monto_esperado_centavos: number;
  tolerancia_pct: number;
  palabras_clave: string[];
  activo: boolean;
}

export interface ReglaReparto {
  id?: string;
  fuente_id: string;
  apartado_id: string;
  porcentaje: number;
}

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  orden: number;
}

export interface ReglaCategoria {
  patron: string;
  categoria_id: string;
}

export interface Movimiento {
  id: string;
  fecha: string;
  monto_centavos: number;
  tipo: TipoMovimiento;
  comercio: string | null;
  descripcion: string | null;
  cuenta_id: string | null;
  categoria_id: string | null;
  apartado_id: string | null;
  fuente_id: string | null;
  origen: OrigenMovimiento;
  estado: EstadoMovimiento;
  avisos: string[];
  terminacion: string | null;
}

export interface PorMover {
  id: string;
  ingreso_id: string | null;
  apartado_id: string;
  periodo: string;
  monto_centavos: number;
  descripcion: string | null;
  hecho_en: string | null;
  movimiento_id: string | null;
}

export interface NotificacionCruda {
  id: string;
  app: string;
  titulo: string | null;
  texto: string | null;
  texto_grande: string | null;
  publicada_en: string;
  estado: EstadoNotificacion;
  resultado: unknown;
  movimiento_id: string | null;
}

/** Lo que manda el teléfono por cada notificación capturada. */
export interface NotificacionEntrada {
  app: string;
  titulo?: string | null;
  texto?: string | null;
  texto_grande?: string | null;
  /** Momento en que Android publicó la notificación (ms desde epoch). */
  publicada_en: number;
  clave?: string | null;
}

/** Todo lo que la lógica necesita saber de la configuración del usuario. */
export interface ConfigUsuario {
  cuentas: Cuenta[];
  fuentes: FuenteIngreso[];
  apartados: Apartado[];
  reglas: ReglaReparto[];
  categorias: Categoria[];
  reglasCategoria: ReglaCategoria[];
}
