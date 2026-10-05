import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConfigUsuario, Movimiento, NotificacionCruda, PorMover } from '@finanzas/core';
import { periodoDe, rangoPeriodo, sumarMeses } from '@finanzas/core';

export interface Dispositivo {
  id: string;
  nombre: string;
  revocado: boolean;
  ultimo_uso: string | null;
  creado_en: string;
}

export const COLUMNAS_MOVIMIENTO =
  'id,fecha,monto_centavos,tipo,comercio,descripcion,cuenta_id,categoria_id,apartado_id,fuente_id,origen,estado,avisos,terminacion';

/** Cuántos meses hacia atrás cargamos (gráficas de 6 meses + metas). */
export const MESES_HISTORIAL = 18;

function revisar<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export async function cargarConfig(db: SupabaseClient): Promise<ConfigUsuario> {
  const [cuentas, fuentes, apartados, reglas, categorias, reglasCategoria] = await Promise.all([
    db.from('cuentas').select('id,banco,alias,terminaciones,es_principal').order('creado_en'),
    db.from('fuentes_ingreso').select('id,nombre,cuenta_id,monto_esperado_centavos,frecuencia,tolerancia_pct,palabras_clave,activo').order('creado_en'),
    db.from('apartados').select('id,nombre,tipo,descripcion,cuenta_id,destino,meta_centavos,saldo_inicial_centavos,color,orden,archivado').order('orden'),
    db.from('reglas_reparto').select('id,fuente_id,apartado_id,porcentaje'),
    db.from('categorias').select('id,nombre,color,orden').order('orden'),
    db.from('reglas_categoria').select('patron,categoria_id'),
  ]);
  return {
    cuentas: revisar(cuentas),
    fuentes: revisar(fuentes),
    apartados: revisar(apartados),
    reglas: revisar(reglas).map((r: { porcentaje: number | string }) => ({ ...r, porcentaje: Number(r.porcentaje) })),
    categorias: revisar(categorias),
    reglasCategoria: revisar(reglasCategoria),
  } as ConfigUsuario;
}

export async function cargarMovimientos(db: SupabaseClient, ahora = new Date()): Promise<Movimiento[]> {
  const desde = rangoPeriodo(sumarMeses(periodoDe(ahora), -(MESES_HISTORIAL - 1))).desde;
  const filas: Movimiento[] = [];
  // Paginamos de 1000 en 1000 (límite de PostgREST).
  for (let pagina = 0; pagina < 20; pagina++) {
    const r = await db
      .from('movimientos')
      .select(COLUMNAS_MOVIMIENTO)
      .gte('fecha', desde.toISOString())
      .neq('estado', 'descartado')
      .order('fecha', { ascending: false })
      .range(pagina * 1000, pagina * 1000 + 999);
    const lote = revisar(r) as Movimiento[];
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  return filas;
}

/** Aportaciones a metas de cualquier fecha (para el saldo de cada meta). */
export async function cargarAportaciones(db: SupabaseClient, desdeHistorial: Date): Promise<Movimiento[]> {
  const r = await db
    .from('movimientos')
    .select(COLUMNAS_MOVIMIENTO)
    .eq('tipo', 'interno')
    .eq('estado', 'confirmado')
    .not('apartado_id', 'is', null)
    .lt('fecha', desdeHistorial.toISOString());
  return revisar(r) as Movimiento[];
}

export async function cargarPorMover(db: SupabaseClient, ahora = new Date()): Promise<PorMover[]> {
  const actual = periodoDe(ahora);
  const r = await db
    .from('por_mover')
    .select('id,ingreso_id,apartado_id,periodo,monto_centavos,descripcion,hecho_en,movimiento_id')
    .in('periodo', [sumarMeses(actual, -1), actual])
    .order('creado_en');
  return revisar(r) as PorMover[];
}

export async function cargarPorRevisar(db: SupabaseClient): Promise<NotificacionCruda[]> {
  const r = await db
    .from('notificaciones_crudas')
    .select('id,app,titulo,texto,texto_grande,publicada_en,estado,resultado,movimiento_id')
    .eq('estado', 'por_revisar')
    .order('publicada_en', { ascending: false })
    .limit(200);
  return revisar(r) as NotificacionCruda[];
}

export async function cargarNotificacionesRecientes(db: SupabaseClient, limite = 50): Promise<NotificacionCruda[]> {
  const r = await db
    .from('notificaciones_crudas')
    .select('id,app,titulo,texto,texto_grande,publicada_en,estado,resultado,movimiento_id')
    .order('publicada_en', { ascending: false })
    .limit(limite);
  return revisar(r) as NotificacionCruda[];
}

export async function cargarDispositivos(db: SupabaseClient): Promise<Dispositivo[]> {
  const r = await db.from('dispositivos').select('id,nombre,revocado,ultimo_uso,creado_en').order('creado_en', { ascending: false });
  return revisar(r) as Dispositivo[];
}
