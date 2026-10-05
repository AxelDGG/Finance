import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Apartado, ConfigUsuario, Movimiento, NotificacionCruda, PorMover } from '@finanzas/core';
import {
  claveDia,
  esGasto,
  gastosPorCategoria,
  partes,
  periodoDe,
  presupuestoDelMes,
  progresoMeta,
  proyeccionMeta,
  rangoPeriodo,
  resumenMes,
  serieDias,
  serieMeses,
  serieSemanasMes,
  sumarMeses,
  type ProgresoMeta,
  type PuntoProyeccion,
} from '@finanzas/core';
import * as acciones from './acciones.ts';
import {
  cargarAportaciones,
  cargarConfig,
  cargarDispositivos,
  cargarMovimientos,
  cargarPorMover,
  cargarPorRevisar,
  MESES_HISTORIAL,
  type Dispositivo,
} from './consultas.ts';

type Parte = 'config' | 'movimientos' | 'porMover' | 'porRevisar' | 'dispositivos';
const TODAS: Parte[] = ['config', 'movimientos', 'porMover', 'porRevisar', 'dispositivos'];

const CONFIG_VACIA: ConfigUsuario = { cuentas: [], fuentes: [], apartados: [], reglas: [], categorias: [], reglasCategoria: [] };

export interface EstadoDatos {
  /** Ya sabemos si hay sesión o no. */
  iniciado: boolean;
  /** Primera carga de datos terminada. */
  listo: boolean;
  cargando: boolean;
  error: string | null;
  sesion: Session | null;
  config: ConfigUsuario;
  movimientos: Movimiento[];
  aportacionesViejas: Movimiento[];
  porMover: PorMover[];
  porRevisar: NotificacionCruda[];
  dispositivos: Dispositivo[];
}

type Acciones = typeof acciones;
type SinDb<F> = F extends (db: SupabaseClient, ...args: infer A) => infer R ? (...args: A) => R : never;
export type AccionesDatos = { [K in Exclude<keyof Acciones, 'reprocesar'>]: SinDb<Acciones[K]> } & {
  reprocesar: () => ReturnType<Acciones['reprocesar']>;
};

export interface ValorDatos extends EstadoDatos {
  db: SupabaseClient;
  urlSupabase: string;
  recargar: (partes?: Parte[]) => Promise<void>;
  acciones: AccionesDatos;
  /** true si el usuario ya configuró cuentas y fuentes. */
  configurado: boolean;
}

const Contexto = createContext<ValorDatos | null>(null);

export function DatosProvider({ db, urlSupabase, children }: { db: SupabaseClient; urlSupabase: string; children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDatos>({
    iniciado: false,
    listo: false,
    cargando: false,
    error: null,
    sesion: null,
    config: CONFIG_VACIA,
    movimientos: [],
    aportacionesViejas: [],
    porMover: [],
    porRevisar: [],
    dispositivos: [],
  });
  const uid = estado.sesion?.user.id ?? null;
  const temporizadores = useRef<Partial<Record<Parte, ReturnType<typeof setTimeout>>>>({});

  // Sesión
  useEffect(() => {
    let vivo = true;
    db.auth.getSession().then(({ data }) => {
      if (vivo) setEstado((e) => ({ ...e, iniciado: true, sesion: data.session }));
    });
    const { data } = db.auth.onAuthStateChange((_evento, sesion) => {
      setEstado((e) => ({ ...e, iniciado: true, sesion, ...(sesion ? {} : { listo: false, config: CONFIG_VACIA, movimientos: [], porMover: [], porRevisar: [], dispositivos: [] }) }));
    });
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [db]);

  const recargar = useCallback(
    async (que: Parte[] = TODAS) => {
      setEstado((e) => ({ ...e, cargando: true }));
      try {
        const ahora = new Date();
        const desdeHistorial = rangoPeriodo(sumarMeses(periodoDe(ahora), -(MESES_HISTORIAL - 1))).desde;
        const [config, movimientos, aportacionesViejas, porMover, porRevisar, dispositivos] = await Promise.all([
          que.includes('config') ? cargarConfig(db) : null,
          que.includes('movimientos') ? cargarMovimientos(db, ahora) : null,
          que.includes('movimientos') ? cargarAportaciones(db, desdeHistorial) : null,
          que.includes('porMover') ? cargarPorMover(db, ahora) : null,
          que.includes('porRevisar') ? cargarPorRevisar(db) : null,
          que.includes('dispositivos') ? cargarDispositivos(db) : null,
        ]);
        setEstado((e) => ({
          ...e,
          cargando: false,
          listo: e.listo || que.length === TODAS.length,
          error: null,
          config: config ?? e.config,
          movimientos: movimientos ?? e.movimientos,
          aportacionesViejas: aportacionesViejas ?? e.aportacionesViejas,
          porMover: porMover ?? e.porMover,
          porRevisar: porRevisar ?? e.porRevisar,
          dispositivos: dispositivos ?? e.dispositivos,
        }));
      } catch (err) {
        setEstado((e) => ({ ...e, cargando: false, listo: true, error: acciones.traducirError(err instanceof Error ? err.message : String(err)) }));
      }
    },
    [db],
  );

  const programar = useCallback(
    (parte: Parte) => {
      clearTimeout(temporizadores.current[parte]);
      temporizadores.current[parte] = setTimeout(() => void recargar([parte]), 250);
    },
    [recargar],
  );

  // Carga inicial + tiempo real al iniciar sesión.
  useEffect(() => {
    if (!uid) return;
    void recargar();
    const filtro = `user_id=eq.${uid}`;
    const canal = db
      .channel(`finanzas-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos', filter: filtro }, () => programar('movimientos'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'por_mover', filter: filtro }, () => programar('porMover'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones_crudas', filter: filtro }, () => programar('porRevisar'))
      .subscribe();
    return () => {
      void db.removeChannel(canal);
    };
  }, [db, uid, recargar, programar]);

  // Cada acción recarga lo que toca al terminar.
  const accionesListas = useMemo(() => {
    const efectos: Partial<Record<keyof Acciones, Parte[]>> = {
      crearMovimiento: ['movimientos'],
      importarMovimientos: ['movimientos'],
      actualizarMovimiento: ['movimientos', 'config'],
      descartarMovimiento: ['movimientos'],
      marcarPorMover: ['porMover', 'movimientos'],
      resolverNotificacion: ['porRevisar', 'movimientos'],
      guardarCuenta: ['config'],
      borrarCuenta: ['config'],
      guardarFuente: ['config'],
      borrarFuente: ['config'],
      guardarApartado: ['config'],
      archivarApartado: ['config'],
      guardarReglas: ['config'],
      guardarCategoria: ['config'],
      registrarDispositivo: ['dispositivos'],
      revocarDispositivo: ['dispositivos'],
      aplicarConfiguracionInicial: ['config'],
      enviarSobranteAMeta: ['porMover'],
    };
    const resultado: Record<string, unknown> = {};
    for (const [nombre, fn] of Object.entries(acciones)) {
      if (typeof fn !== 'function') continue;
      const recargas = efectos[nombre as keyof Acciones];
      const necesitaDb = fn.length > 0 && !['traducirError', 'lecturaDeNotificacion', 'categoriaPorNombre'].includes(nombre);
      if (!necesitaDb) {
        resultado[nombre] = fn;
        continue;
      }
      resultado[nombre] = async (...args: unknown[]) => {
        const r = nombre === 'reprocesar' ? await (fn as (...a: unknown[]) => unknown)(db, urlSupabase) : await (fn as (...a: unknown[]) => unknown)(db, ...args);
        if (recargas) await recargar(recargas);
        if (nombre === 'reprocesar') await recargar(['porRevisar', 'movimientos', 'porMover']);
        return r;
      };
    }
    return resultado as AccionesDatos;
  }, [db, urlSupabase, recargar]);

  const valor = useMemo<ValorDatos>(
    () => ({
      ...estado,
      db,
      urlSupabase,
      recargar,
      acciones: accionesListas,
      configurado: estado.config.cuentas.length > 0 && estado.config.fuentes.length > 0,
    }),
    [estado, db, urlSupabase, recargar, accionesListas],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDatos(): ValorDatos {
  const v = useContext(Contexto);
  if (!v) throw new Error('useDatos debe usarse dentro de <DatosProvider>');
  return v;
}

export interface MetaConProgreso {
  apartado: Apartado;
  progreso: ProgresoMeta;
  proyeccion: PuntoProyeccion[];
}

/** Todo lo que muestran las pantallas de resumen, ya calculado con @finanzas/core. */
export function useResumen(ahora: Date = new Date()) {
  const { config, movimientos, aportacionesViejas, porMover } = useDatos();
  // Recalcular cuando cambie el día, no en cada render.
  const dia = claveDia(ahora);
  return useMemo(() => {
    const momento = new Date();
    const periodo = periodoDe(momento);
    const movsMes = movimientos.filter((m) => periodoDe(m.fecha) === periodo);
    const presupuesto = presupuestoDelMes(config, movsMes);
    const resumen = resumenMes(movsMes, presupuesto.total, momento);

    // Comparaciones: semana anterior y mes anterior hasta el mismo día.
    const hoy = partes(momento).dia;
    const anterior = sumarMeses(periodo, -1);
    const gastoMesAnteriorAlDia = movimientos
      .filter((m) => esGasto(m) && periodoDe(m.fecha) === anterior && partes(m.fecha).dia <= hoy)
      .reduce((a, m) => a + m.monto_centavos, 0);
    const semana = serieDias(movimientos, momento, 7);
    const semanaPrevia = serieDias(movimientos, new Date(momento.getTime() - 7 * 86400000), 7);
    const totalSemana = semana.reduce((a, p) => a + p.monto, 0);
    const totalSemanaPrevia = semanaPrevia.reduce((a, p) => a + p.monto, 0);

    const todos = [...movimientos, ...aportacionesViejas];
    const metas: MetaConProgreso[] = config.apartados
      .filter((a) => a.tipo === 'meta' && !a.archivado)
      .map((a) => ({ apartado: a, progreso: progresoMeta(a, todos, config, momento), proyeccion: proyeccionMeta(a, todos, config, momento) }));

    const porMoverMes = porMover.filter((p) => p.periodo === periodo || !p.hecho_en);
    return {
      periodo,
      movsMes,
      presupuesto,
      resumen,
      categorias: gastosPorCategoria(movsMes, config.categorias),
      series: { dias: semana, semanas: serieSemanasMes(movimientos, periodo, momento), meses: serieMeses(movimientos, momento, 6) },
      comparacion: {
        semana: totalSemanaPrevia > 0 ? ((totalSemana - totalSemanaPrevia) / totalSemanaPrevia) * 100 : null,
        mes: gastoMesAnteriorAlDia > 0 ? ((resumen.gastado - gastoMesAnteriorAlDia) / gastoMesAnteriorAlDia) * 100 : null,
      },
      metas,
      gastos: config.apartados.find((a) => a.tipo === 'gastos') ?? null,
      porMoverMes,
      pendientesPorMover: porMoverMes.filter((p) => !p.hecho_en),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, movimientos, aportacionesViejas, porMover, dia]);
}
