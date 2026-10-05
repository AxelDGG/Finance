// Edge Function "ingesta".
//
//  POST /ingesta             (header x-llave-dispositivo)  ← el teléfono manda notificaciones
//  POST /ingesta/reprocesar  (Authorization: Bearer <jwt>) ← vuelve a interpretar las que
//                                                            quedaron "por revisar" o con error
//  GET  /ingesta/salud                                      ← prueba de vida
//
// Se publica ya empaquetada (scripts/build-functions.mjs) porque importa
// la lógica compartida de packages/core.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  buscarFusion,
  clasificar,
  formatoMXN,
  parsearNotificacion,
  periodoDe,
  repartirIngreso,
  sumarMeses,
  VENTANA_BUSQUEDA_MS,
  type ConfigUsuario,
  type EventoParseado,
  type Movimiento,
  type NotificacionEntrada,
} from '../../../packages/core/src/index.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-llave-dispositivo',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const MAX_POR_LOTE = 100;

interface Aviso {
  titulo: string;
  texto: string;
}

interface Resultado {
  estado: string;
  tipo?: string;
  monto_centavos?: number | null;
  movimiento_id?: string | null;
  razon?: string | null;
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function sha256(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function clienteAdmin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function cargarConfig(db: SupabaseClient, userId: string): Promise<ConfigUsuario> {
  const [cuentas, fuentes, apartados, reglas, categorias, reglasCategoria] = await Promise.all([
    db.from('cuentas').select('id,banco,alias,terminaciones,es_principal').eq('user_id', userId),
    db.from('fuentes_ingreso').select('id,nombre,cuenta_id,monto_esperado_centavos,tolerancia_pct,palabras_clave,activo').eq('user_id', userId),
    db.from('apartados').select('id,nombre,tipo,descripcion,cuenta_id,destino,meta_centavos,saldo_inicial_centavos,color,orden,archivado').eq('user_id', userId),
    db.from('reglas_reparto').select('id,fuente_id,apartado_id,porcentaje').eq('user_id', userId),
    db.from('categorias').select('id,nombre,color,orden').eq('user_id', userId),
    db.from('reglas_categoria').select('patron,categoria_id').eq('user_id', userId),
  ]);
  for (const r of [cuentas, fuentes, apartados, reglas, categorias, reglasCategoria]) if (r.error) throw r.error;
  return {
    cuentas: cuentas.data ?? [],
    fuentes: fuentes.data ?? [],
    apartados: apartados.data ?? [],
    reglas: (reglas.data ?? []).map((r) => ({ ...r, porcentaje: Number(r.porcentaje) })),
    categorias: categorias.data ?? [],
    reglasCategoria: reglasCategoria.data ?? [],
  } as ConfigUsuario;
}

const COLUMNAS_MOV =
  'id,fecha,monto_centavos,tipo,comercio,descripcion,cuenta_id,categoria_id,apartado_id,fuente_id,origen,estado,avisos,terminacion';

/** Interpreta una notificación ya guardada y crea o actualiza su movimiento. */
async function interpretar(
  db: SupabaseClient,
  userId: string,
  notificacionId: string,
  entrada: NotificacionEntrada,
  config: ConfigUsuario,
  avisos: Aviso[],
): Promise<Resultado> {
  const evento = parsearNotificacion(entrada);
  const guardarEstado = (estado: string, resultado: unknown, movimientoId: string | null = null) =>
    db.from('notificaciones_crudas').update({ estado, resultado, movimiento_id: movimientoId }).eq('id', notificacionId);

  if (!evento) {
    await guardarEstado('ignorada', { motivo: 'App no reconocida' });
    return { estado: 'ignorada' };
  }

  const clasificacion = clasificar(evento, config);
  const propuesto = clasificacion.movimiento;
  if (!propuesto) {
    await guardarEstado(clasificacion.estadoNotificacion, { evento, motivo: clasificacion.motivo });
    return { estado: clasificacion.estadoNotificacion, tipo: evento.tipo, monto_centavos: evento.monto_centavos };
  }

  const t = Date.parse(propuesto.fecha);
  const { data: candidatos, error: errCand } = await db
    .from('movimientos')
    .select(COLUMNAS_MOV)
    .eq('user_id', userId)
    .eq('monto_centavos', propuesto.monto_centavos)
    .neq('estado', 'descartado')
    .gte('fecha', new Date(t - VENTANA_BUSQUEDA_MS).toISOString())
    .lte('fecha', new Date(t + VENTANA_BUSQUEDA_MS).toISOString());
  if (errCand) throw errCand;

  const fusion = buscarFusion(propuesto, evento.tipo, (candidatos ?? []) as Movimiento[]);
  let movimientoId: string;
  let esNuevo = false;

  if (fusion) {
    movimientoId = fusion.movimientoId;
    if (Object.keys(fusion.cambios).length > 0) {
      const { error } = await db.from('movimientos').update(fusion.cambios).eq('id', movimientoId);
      if (error) throw error;
    }
  } else {
    // ¿Es la transferencia de un "por mover" pendiente? Entonces es un apartado.
    const porMover = evento.tipo === 'transferencia_enviada' ? await buscarPorMoverPendiente(db, userId, propuesto.monto_centavos, propuesto.fecha) : null;
    if (porMover) {
      propuesto.tipo = 'interno';
      propuesto.apartado_id = porMover.apartado_id;
      propuesto.categoria_id = null;
    }
    const { data, error } = await db
      .from('movimientos')
      .insert({ ...propuesto, user_id: userId, origen: 'notificacion' })
      .select('id')
      .single();
    if (error) throw error;
    movimientoId = data.id as string;
    esNuevo = true;
    if (porMover) {
      await db.from('por_mover').update({ hecho_en: new Date().toISOString(), movimiento_id: movimientoId }).eq('id', porMover.id);
      avisos.push({ titulo: 'Apartado registrado', texto: `${formatoMXN(propuesto.monto_centavos)} · ${porMover.descripcion ?? 'movimiento por hacer'}` });
    }
  }

  // Un ingreso nuevo de una de tus fuentes genera la lista de "por mover".
  if (esNuevo && propuesto.tipo === 'ingreso' && propuesto.fuente_id) {
    await crearPorMover(db, userId, movimientoId, propuesto.monto_centavos, propuesto.fuente_id, propuesto.cuenta_id, propuesto.fecha, config, avisos);
  }

  await guardarEstado('procesada', { evento: resumirEvento(evento), razon: fusion?.razon ?? null }, movimientoId);
  return { estado: 'procesada', tipo: propuesto.tipo, monto_centavos: propuesto.monto_centavos, movimiento_id: movimientoId, razon: fusion?.razon ?? null };
}

function resumirEvento(e: EventoParseado) {
  return { tipo: e.tipo, aviso: e.aviso, banco: e.banco, monto_centavos: e.monto_centavos, comercio: e.comercio, terminacion: e.terminacion, confianza: e.confianza };
}

async function buscarPorMoverPendiente(db: SupabaseClient, userId: string, monto: number, fecha: string) {
  const periodo = periodoDe(fecha);
  const { data } = await db
    .from('por_mover')
    .select('id,apartado_id,descripcion')
    .eq('user_id', userId)
    .eq('monto_centavos', monto)
    .is('hecho_en', null)
    .in('periodo', [periodo, sumarMeses(periodo, -1)])
    .order('creado_en', { ascending: true })
    .limit(1);
  return data?.[0] ?? null;
}

async function crearPorMover(
  db: SupabaseClient,
  userId: string,
  ingresoId: string,
  monto: number,
  fuenteId: string,
  cuentaId: string | null,
  fecha: string,
  config: ConfigUsuario,
  avisos: Aviso[],
) {
  const partes = repartirIngreso(monto, fuenteId, cuentaId, config).filter((p) => p.requiereMover && p.monto_centavos > 0);
  const fuente = config.fuentes.find((f) => f.id === fuenteId);
  if (partes.length > 0) {
    const { error } = await db.from('por_mover').insert(
      partes.map((p) => ({
        user_id: userId,
        ingreso_id: ingresoId,
        apartado_id: p.apartado_id,
        periodo: periodoDe(fecha),
        monto_centavos: p.monto_centavos,
        descripcion: p.descripcion,
      })),
    );
    if (error) throw error;
  }
  avisos.push({
    titulo: `Llegó tu ${fuente?.nombre ?? 'ingreso'}: ${formatoMXN(monto)}`,
    texto: partes.length > 0 ? partes.map((p) => p.descripcion).join(' · ') : 'Todo se queda para gastar este mes.',
  });
}

async function ingerir(req: Request): Promise<Response> {
  const llave = req.headers.get('x-llave-dispositivo');
  if (!llave) return json({ error: 'Falta la llave del dispositivo' }, 401);

  const db = clienteAdmin();
  const { data: dispositivo, error } = await db
    .from('dispositivos')
    .select('id,user_id,revocado')
    .eq('llave_hash', await sha256(llave))
    .maybeSingle();
  if (error) throw error;
  if (!dispositivo || dispositivo.revocado) return json({ error: 'Dispositivo no autorizado' }, 401);

  const cuerpo = await req.json().catch(() => null);
  const lote: NotificacionEntrada[] = Array.isArray(cuerpo?.notificaciones) ? cuerpo.notificaciones.slice(0, MAX_POR_LOTE) : [];
  await db.from('dispositivos').update({ ultimo_uso: new Date().toISOString() }).eq('id', dispositivo.id);
  if (lote.length === 0) return json({ procesadas: 0, resultados: [], avisos: [] });

  const config = await cargarConfig(db, dispositivo.user_id);
  const resultados: Resultado[] = [];
  const avisos: Aviso[] = [];

  // En orden de publicación para que la fusión Wallet/banco funcione igual que en vivo.
  lote.sort((a, b) => Number(a.publicada_en) - Number(b.publicada_en));
  for (const n of lote) {
    try {
      if (typeof n?.app !== 'string' || !Number.isFinite(Number(n.publicada_en))) {
        resultados.push({ estado: 'invalida' });
        continue;
      }
      const entrada: NotificacionEntrada = {
        app: n.app.slice(0, 200),
        titulo: n.titulo?.slice(0, 500) ?? null,
        texto: n.texto?.slice(0, 2000) ?? null,
        texto_grande: n.texto_grande?.slice(0, 4000) ?? null,
        publicada_en: Number(n.publicada_en),
        clave: n.clave?.slice(0, 300) ?? null,
      };
      const huella = await sha256(
        [entrada.app, entrada.titulo, entrada.texto, entrada.texto_grande, Math.floor(entrada.publicada_en / 60000)].join('|'),
      );
      const { data: guardada, error: errIns } = await db
        .from('notificaciones_crudas')
        .upsert(
          {
            user_id: dispositivo.user_id,
            dispositivo_id: dispositivo.id,
            app: entrada.app,
            titulo: entrada.titulo,
            texto: entrada.texto,
            texto_grande: entrada.texto_grande,
            publicada_en: new Date(entrada.publicada_en).toISOString(),
            clave: entrada.clave,
            huella,
          },
          { onConflict: 'user_id,huella', ignoreDuplicates: true },
        )
        .select('id');
      if (errIns) throw errIns;
      if (!guardada || guardada.length === 0) {
        resultados.push({ estado: 'duplicada' });
        continue;
      }
      resultados.push(await interpretar(db, dispositivo.user_id, guardada[0]!.id, entrada, config, avisos));
    } catch (e) {
      console.error('Error procesando notificación', e);
      resultados.push({ estado: 'error' });
    }
  }
  return json({ procesadas: resultados.filter((r) => r.estado !== 'duplicada').length, resultados, avisos });
}

async function reprocesar(req: Request): Promise<Response> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Necesitas iniciar sesión' }, 401);
  const db = clienteAdmin();
  const { data: usuario, error } = await db.auth.getUser(token);
  if (error || !usuario.user) return json({ error: 'Sesión inválida' }, 401);
  const userId = usuario.user.id;

  const { data: pendientes, error: errPend } = await db
    .from('notificaciones_crudas')
    .select('id,app,titulo,texto,texto_grande,publicada_en,clave')
    .eq('user_id', userId)
    .in('estado', ['pendiente', 'por_revisar', 'error'])
    .order('publicada_en', { ascending: true })
    .limit(500);
  if (errPend) throw errPend;

  const config = await cargarConfig(db, userId);
  const resultados: Resultado[] = [];
  const avisos: Aviso[] = [];
  for (const n of pendientes ?? []) {
    try {
      resultados.push(
        await interpretar(db, userId, n.id, { ...n, publicada_en: Date.parse(n.publicada_en) }, config, avisos),
      );
    } catch (e) {
      console.error('Error reprocesando', e);
      await db.from('notificaciones_crudas').update({ estado: 'error', resultado: { error: String(e) } }).eq('id', n.id);
      resultados.push({ estado: 'error' });
    }
  }
  const resumen = resultados.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.estado]: (acc[r.estado] ?? 0) + 1 }), {});
  return json({ revisadas: resultados.length, resumen, avisos });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const ruta = new URL(req.url).pathname;
  try {
    if (req.method === 'GET' && ruta.endsWith('/salud')) return json({ ok: true, version: 2 });
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
    if (ruta.endsWith('/reprocesar')) return await reprocesar(req);
    return await ingerir(req);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
