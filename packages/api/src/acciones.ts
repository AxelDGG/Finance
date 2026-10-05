import type { SupabaseClient } from '@supabase/supabase-js';
import type { Apartado, Aviso, Banco, Cuenta, FuenteIngreso, Movimiento, NotificacionCruda, TipoMovimiento } from '@finanzas/core';
import { APPS, categoriaPorNombre, parsearNotificacion, periodoDe, resolverApp } from '@finanzas/core';
import { descripcionSobrante } from './textos.ts';

function revisar<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(traducirError(r.error.message));
  return r.data as T;
}

/** Mensajes de error de la base, en palabras normales. */
export function traducirError(mensaje: string): string {
  if (/Invalid login credentials/i.test(mensaje)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(mensaje)) return 'Confirma tu correo antes de entrar (revisa tu bandeja).';
  if (/User already registered/i.test(mensaje)) return 'Ese correo ya tiene cuenta. Inicia sesión.';
  if (/Password should be at least/i.test(mensaje)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit/i.test(mensaje)) return 'Demasiados intentos. Espera un momento.';
  if (/Failed to fetch|Network request failed|fetch failed/i.test(mensaje)) return 'Sin conexión. Revisa tu internet.';
  if (/suman/.test(mensaje)) return mensaje.replace(/^.*?(Las reglas)/, '$1');
  return mensaje;
}

export interface NuevoMovimiento {
  tipo: TipoMovimiento;
  monto_centavos: number;
  fecha?: string;
  comercio?: string | null;
  descripcion?: string | null;
  cuenta_id?: string | null;
  categoria_id?: string | null;
  apartado_id?: string | null;
  fuente_id?: string | null;
  /** 'importado' para lo que viene de un estado de cuenta. */
  origen?: 'manual' | 'importado';
}

export async function crearMovimiento(db: SupabaseClient, m: NuevoMovimiento): Promise<Movimiento> {
  const r = await db
    .from('movimientos')
    .insert({
      tipo: m.tipo,
      monto_centavos: m.monto_centavos,
      fecha: m.fecha ?? new Date().toISOString(),
      comercio: m.comercio ?? null,
      descripcion: m.descripcion ?? null,
      cuenta_id: m.cuenta_id ?? null,
      categoria_id: m.categoria_id ?? null,
      apartado_id: m.apartado_id ?? null,
      fuente_id: m.fuente_id ?? null,
      origen: m.origen ?? 'manual',
      estado: 'confirmado',
    })
    .select()
    .single();
  return revisar(r) as Movimiento;
}

/** Inserta de una vez lo que faltaba de un estado de cuenta. */
export async function importarMovimientos(db: SupabaseClient, lista: NuevoMovimiento[]): Promise<number> {
  if (lista.length === 0) return 0;
  const filas = lista.map((m) => ({
    tipo: m.tipo,
    monto_centavos: m.monto_centavos,
    fecha: m.fecha ?? new Date().toISOString(),
    comercio: m.comercio ?? null,
    descripcion: m.descripcion ?? null,
    cuenta_id: m.cuenta_id ?? null,
    categoria_id: m.categoria_id ?? null,
    apartado_id: m.apartado_id ?? null,
    fuente_id: m.fuente_id ?? null,
    origen: 'importado',
    estado: 'confirmado',
  }));
  revisar(await db.from('movimientos').insert(filas));
  return filas.length;
}

export async function actualizarMovimiento(db: SupabaseClient, id: string, cambios: Partial<Omit<NuevoMovimiento, 'origen'> & { estado: Movimiento['estado'] }>) {
  revisar(await db.from('movimientos').update(cambios).eq('id', id));
}

/** No se borra: queda "descartado" para que un aviso repetido no lo vuelva a crear. */
export async function descartarMovimiento(db: SupabaseClient, id: string) {
  revisar(await db.from('movimientos').update({ estado: 'descartado' }).eq('id', id));
}

export async function marcarPorMover(db: SupabaseClient, id: string, hecho: boolean) {
  revisar(await db.rpc('marcar_por_mover', { p_id: id, p_hecho: hecho }));
}

/** Convierte una notificación "por revisar" en movimiento (o la ignora). */
export async function resolverNotificacion(
  db: SupabaseClient,
  notificacion: NotificacionCruda,
  decision: { ignorar: true } | (NuevoMovimiento & { ignorar?: false }),
) {
  if ('ignorar' in decision && decision.ignorar) {
    revisar(await db.from('notificaciones_crudas').update({ estado: 'ignorada' }).eq('id', notificacion.id));
    return null;
  }
  const { app } = resolverApp(notificacion.app, notificacion.titulo);
  const aviso: Aviso | undefined = APPS[app]?.aviso;
  const r = await db
    .from('movimientos')
    .insert({
      tipo: decision.tipo,
      monto_centavos: decision.monto_centavos,
      fecha: decision.fecha ?? notificacion.publicada_en,
      comercio: decision.comercio ?? null,
      cuenta_id: decision.cuenta_id ?? null,
      categoria_id: decision.categoria_id ?? null,
      apartado_id: decision.apartado_id ?? null,
      fuente_id: decision.fuente_id ?? null,
      origen: 'notificacion',
      estado: 'confirmado',
      avisos: aviso ? [aviso] : [],
    })
    .select('id')
    .single();
  const { id } = revisar(r) as { id: string };
  revisar(await db.from('notificaciones_crudas').update({ estado: 'procesada', movimiento_id: id }).eq('id', notificacion.id));
  return id;
}

/** Lo que el parser alcanzó a leer de una notificación por revisar (para prellenar). */
export function lecturaDeNotificacion(n: NotificacionCruda) {
  return parsearNotificacion({ app: n.app, titulo: n.titulo, texto: n.texto, texto_grande: n.texto_grande, publicada_en: Date.parse(n.publicada_en) });
}

// ---------------------------------------------------------------- configuración

export async function guardarCuenta(db: SupabaseClient, c: Partial<Cuenta> & { banco: Banco; alias: string }) {
  const fila = { banco: c.banco, alias: c.alias, terminaciones: c.terminaciones ?? [], es_principal: c.es_principal ?? false };
  return revisar(c.id ? await db.from('cuentas').update(fila).eq('id', c.id).select().single() : await db.from('cuentas').insert(fila).select().single()) as Cuenta;
}

export async function borrarCuenta(db: SupabaseClient, id: string) {
  revisar(await db.from('cuentas').delete().eq('id', id));
}

export async function guardarFuente(db: SupabaseClient, f: Partial<FuenteIngreso> & { nombre: string; monto_esperado_centavos: number }) {
  const fila = {
    nombre: f.nombre,
    cuenta_id: f.cuenta_id ?? null,
    monto_esperado_centavos: f.monto_esperado_centavos,
    tolerancia_pct: f.tolerancia_pct ?? 20,
    palabras_clave: f.palabras_clave ?? [],
    activo: f.activo ?? true,
  };
  return revisar(
    f.id ? await db.from('fuentes_ingreso').update(fila).eq('id', f.id).select().single() : await db.from('fuentes_ingreso').insert(fila).select().single(),
  ) as FuenteIngreso;
}

export async function borrarFuente(db: SupabaseClient, id: string) {
  revisar(await db.from('fuentes_ingreso').delete().eq('id', id));
}

export async function guardarApartado(db: SupabaseClient, a: Partial<Apartado> & { nombre: string }) {
  const fila = {
    nombre: a.nombre,
    tipo: a.tipo ?? 'meta',
    descripcion: a.descripcion ?? null,
    cuenta_id: a.cuenta_id ?? null,
    destino: a.destino ?? null,
    meta_centavos: a.meta_centavos ?? null,
    saldo_inicial_centavos: a.saldo_inicial_centavos ?? 0,
    color: a.color ?? '#9A8DF2',
    orden: a.orden ?? 10,
    archivado: a.archivado ?? false,
  };
  return revisar(
    a.id ? await db.from('apartados').update(fila).eq('id', a.id).select().single() : await db.from('apartados').insert(fila).select().single(),
  ) as Apartado;
}

export async function archivarApartado(db: SupabaseClient, id: string) {
  revisar(await db.from('apartados').update({ archivado: true }).eq('id', id));
}

/**
 * Reemplaza los % de una fuente. Primero borra y luego inserta para que la
 * validación "no más de 100 %" no choque con los valores viejos.
 */
export async function guardarReglas(db: SupabaseClient, fuenteId: string, reglas: Array<{ apartado_id: string; porcentaje: number }>) {
  const validas = reglas.filter((r) => r.porcentaje > 0);
  const total = validas.reduce((a, r) => a + r.porcentaje, 0);
  if (total > 100) throw new Error(`Las reglas suman ${total} %; el máximo es 100 %.`);
  revisar(await db.from('reglas_reparto').delete().eq('fuente_id', fuenteId));
  if (validas.length > 0) {
    revisar(await db.from('reglas_reparto').insert(validas.map((r) => ({ fuente_id: fuenteId, apartado_id: r.apartado_id, porcentaje: r.porcentaje }))));
  }
}

export async function guardarCategoria(db: SupabaseClient, c: { id?: string; nombre: string; color: string; orden?: number }) {
  const fila = { nombre: c.nombre, color: c.color, orden: c.orden ?? 50 };
  revisar(c.id ? await db.from('categorias').update(fila).eq('id', c.id) : await db.from('categorias').insert(fila));
}

// ---------------------------------------------------------------- dispositivos

export async function registrarDispositivo(db: SupabaseClient, nombre: string): Promise<string> {
  return revisar(await db.rpc('registrar_dispositivo', { p_nombre: nombre })) as string;
}

export async function revocarDispositivo(db: SupabaseClient, id: string) {
  revisar(await db.from('dispositivos').update({ revocado: true }).eq('id', id));
}

/** Vuelve a interpretar las notificaciones "por revisar" (p. ej. tras mejorar los parsers). */
export async function reprocesar(db: SupabaseClient, urlSupabase: string): Promise<{ revisadas: number; resumen: Record<string, number> }> {
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Necesitas iniciar sesión');
  const r = await fetch(`${urlSupabase}/functions/v1/ingesta/reprocesar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const cuerpo = await r.json();
  if (!r.ok) throw new Error(cuerpo.error ?? 'No se pudo reprocesar');
  return cuerpo;
}

// ---------------------------------------------------------------- configuración inicial

export interface ConfiguracionInicial {
  cuentas: Array<{ clave: string; banco: Banco; alias: string; terminaciones: string[]; es_principal: boolean }>;
  /** Clave de la cuenta donde vive "Gastos personales". */
  cuentaGastos: string;
  fuentes: Array<{ nombre: string; cuenta: string; monto_esperado_centavos: number; reglas: Record<string, number> }>;
  metas: Array<{ clave: string; nombre: string; descripcion: string | null; meta_centavos: number | null; saldo_inicial_centavos: number; destino: string | null; color: string }>;
}

/** Crea cuentas, metas, fuentes y reglas de una sola vez (pantalla de bienvenida). */
export async function aplicarConfiguracionInicial(db: SupabaseClient, c: ConfiguracionInicial) {
  const idsCuenta: Record<string, string> = {};
  for (const cuenta of c.cuentas) {
    const creada = await guardarCuenta(db, cuenta);
    idsCuenta[cuenta.clave] = creada.id;
  }
  revisar(await db.from('apartados').update({ cuenta_id: idsCuenta[c.cuentaGastos] ?? null }).eq('tipo', 'gastos'));

  const idsMeta: Record<string, string> = {};
  let orden = 1;
  for (const meta of c.metas) {
    const creada = await guardarApartado(db, { ...meta, tipo: 'meta', orden: orden++ });
    idsMeta[meta.clave] = creada.id;
  }
  for (const fuente of c.fuentes) {
    const creada = await guardarFuente(db, { nombre: fuente.nombre, cuenta_id: idsCuenta[fuente.cuenta] ?? null, monto_esperado_centavos: fuente.monto_esperado_centavos });
    await guardarReglas(
      db,
      creada.id,
      Object.entries(fuente.reglas)
        .filter(([clave]) => idsMeta[clave])
        .map(([clave, porcentaje]) => ({ apartado_id: idsMeta[clave]!, porcentaje })),
    );
  }
}

// ---------------------------------------------------------------- cierre de mes

/**
 * Propone mover lo que sobró de Gastos personales a una meta. Crea un
 * "por mover" en el mes siguiente que marcas cuando lo hagas en el banco.
 */
export async function enviarSobranteAMeta(db: SupabaseClient, periodo: string, monto: number, apartado: Apartado) {
  if (monto <= 0) throw new Error('No hay sobrante para mover');
  const siguiente = periodoDe(new Date());
  revisar(
    await db.from('por_mover').insert({
      apartado_id: apartado.id,
      periodo: siguiente,
      monto_centavos: monto,
      descripcion: descripcionSobrante(periodo, monto, apartado.nombre),
    }),
  );
}

export { categoriaPorNombre };
