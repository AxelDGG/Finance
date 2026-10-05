// Modo demostración: un Supabase de mentira, en memoria, con datos de ejemplo.
// Sirve para enseñar la app sin cuenta y para probar la interfaz sin tocar datos reales.
import type { SupabaseClient } from '@supabase/supabase-js';
import { desdeLocal, normalizarComercio, partes, periodoDe, sumarMeses } from '@finanzas/core';

type Fila = Record<string, unknown> & { id: string };
type Tablas = Record<string, Fila[]>;

export const enDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
/** `?demo=vacio`: una cuenta recién creada, para probar el asistente de configuración. */
const demoVacia = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'vacio';

export function entrarDemo() {
  window.location.href = `${window.location.pathname}?demo=1#/resumen`;
}
export function salirDemo() {
  window.location.href = `${window.location.pathname}#/resumen`;
}

let contador = 0;
const nuevoId = () => `demo-${Date.now().toString(36)}-${(contador++).toString(36)}`;

/** Números pseudoaleatorios repetibles: la demo se ve igual cada vez. */
function aleatorio(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const CATEGORIAS: Array<[string, string]> = [
  ['Comida', '#9A8DF2'],
  ['Súper', '#E2E3E7'],
  ['Transporte', '#A7AAB2'],
  ['Suscripciones', '#6F737D'],
  ['Entretenimiento', '#5E58A0'],
  ['Salud', '#C9C1FF'],
  ['Servicios', '#8B8F98'],
  ['Compras', '#B3A8FF'],
  ['Hogar', '#4B4E57'],
  ['Transferencias', '#7A6CE0'],
  ['Otros', '#34363D'],
];

// Comercio, categoría, monto mínimo y máximo (pesos), veces por mes aproximadas.
const COMERCIOS: Array<[string, string, number, number, number]> = [
  ['OXXO', 'Súper', 35, 180, 9],
  ['Walmart', 'Súper', 350, 1400, 2],
  ['Uber', 'Transporte', 60, 220, 5],
  ['DiDi Food', 'Comida', 140, 380, 3],
  ['Starbucks', 'Comida', 75, 160, 3],
  ['Tacos El Güero', 'Comida', 90, 260, 3],
  ['Spotify', 'Suscripciones', 129, 129, 1],
  ['Netflix', 'Suscripciones', 219, 219, 1],
  ['Cinépolis', 'Entretenimiento', 120, 340, 1],
  ['Farmacias Guadalajara', 'Salud', 80, 420, 1],
  ['Telcel', 'Servicios', 299, 299, 1],
  ['Mercado Libre', 'Compras', 250, 900, 1],
  ['Pemex', 'Transporte', 300, 700, 2],
];

/** Lo que la base crea al registrarse: categorías y el apartado Gastos personales. */
function crearCuentaNueva(): Tablas {
  const t: Tablas = { cuentas: [], fuentes_ingreso: [], apartados: [], reglas_reparto: [], categorias: [], reglas_categoria: [], movimientos: [], por_mover: [], notificaciones_crudas: [], dispositivos: [] };
  CATEGORIAS.forEach(([nombre, color], i) => t.categorias!.push({ id: `cat-${i}`, nombre, color, orden: i + 1 }));
  t.apartados!.push({ id: 'ap-gastos', nombre: 'Gastos personales', tipo: 'gastos', descripcion: 'Tu dinero para gastar en el mes', cuenta_id: null, destino: null, meta_centavos: null, saldo_inicial_centavos: 0, color: '#E2E3E7', orden: 0, archivado: false });
  return t;
}

function crearDatos(): Tablas {
  const azar = aleatorio(20261004);
  const ahora = new Date();
  const actual = periodoDe(ahora);
  const hoy = partes(ahora);
  const t: Tablas = { cuentas: [], fuentes_ingreso: [], apartados: [], reglas_reparto: [], categorias: [], reglas_categoria: [], movimientos: [], por_mover: [], notificaciones_crudas: [], dispositivos: [] };
  const creado = (dias: number) => new Date(ahora.getTime() - dias * 86400000).toISOString();

  const bbva = { id: 'cta-bbva', banco: 'BBVA', alias: 'BBVA', terminaciones: ['4821', '0937'], es_principal: true, creado_en: creado(200) };
  const sant = { id: 'cta-sant', banco: 'Santander', alias: 'Santander', terminaciones: ['7710'], es_principal: false, creado_en: creado(199) };
  t.cuentas!.push(bbva, sant);
  CATEGORIAS.forEach(([nombre, color], i) => t.categorias!.push({ id: `cat-${i}`, nombre, color, orden: i + 1 }));
  const cat = (nombre: string) => t.categorias!.find((c) => c.nombre === nombre)!.id;

  const gastos = { id: 'ap-gastos', nombre: 'Gastos personales', tipo: 'gastos', descripcion: 'Tu dinero para gastar en el mes', cuenta_id: 'cta-bbva', destino: null, meta_centavos: null, saldo_inicial_centavos: 0, color: '#E2E3E7', orden: 0, archivado: false };
  const viaje = { id: 'ap-viaje', nombre: 'Viaje', tipo: 'meta', descripcion: null, cuenta_id: null, destino: 'Apartado en BBVA', meta_centavos: 3_600_000, saldo_inicial_centavos: 1_080_000, color: '#9A8DF2', orden: 1, archivado: false };
  const ahorro = { id: 'ap-ahorro', nombre: 'Ahorro', tipo: 'meta', descripcion: null, cuenta_id: null, destino: 'Cuenta de ahorro Santander', meta_centavos: 3_000_000, saldo_inicial_centavos: 600_000, color: '#5E58A0', orden: 2, archivado: false };
  t.apartados!.push(gastos, viaje, ahorro);
  t.fuentes_ingreso!.push(
    { id: 'f-principal', nombre: 'Ingreso principal', cuenta_id: 'cta-sant', monto_esperado_centavos: 1_200_000, tolerancia_pct: 20, palabras_clave: [], activo: true, creado_en: creado(200) },
    { id: 'f-secundario', nombre: 'Ingreso secundario', cuenta_id: 'cta-bbva', monto_esperado_centavos: 350_000, tolerancia_pct: 20, palabras_clave: [], activo: true, creado_en: creado(199) },
  );
  t.reglas_reparto!.push({ id: 'r1', fuente_id: 'f-principal', apartado_id: 'ap-viaje', porcentaje: 30 }, { id: 'r2', fuente_id: 'f-principal', apartado_id: 'ap-ahorro', porcentaje: 20 });

  const mov = (m: Partial<Fila> & { fecha: Date; monto_centavos: number; tipo: string }) =>
    t.movimientos!.push({
      id: nuevoId(),
      comercio: null,
      descripcion: null,
      cuenta_id: null,
      categoria_id: null,
      apartado_id: null,
      fuente_id: null,
      origen: 'notificacion',
      estado: 'confirmado',
      avisos: [],
      terminacion: null,
      ...m,
      fecha: m.fecha.toISOString(),
    });

  // Seis meses de historia más el mes en curso.
  for (let i = 6; i >= 0; i--) {
    const p = sumarMeses(actual, -i);
    const [anio, mes] = p.split('-').map(Number) as [number, number];
    const ultimo = i === 0 ? hoy.dia : new Date(anio, mes, 0).getDate();
    // Ingresos: el principal llega el 1, el secundario el 15.
    const ingresos: Array<[number, string, string, number]> = [
      [1, 'f-principal', 'cta-sant', 1_200_000],
      [15, 'f-secundario', 'cta-bbva', 350_000],
    ];
    for (const [dia, fuente, cuenta, monto] of ingresos) {
      if (dia > ultimo) continue;
      mov({ fecha: desdeLocal(anio, mes, dia, 9, 12), monto_centavos: monto, tipo: 'ingreso', fuente_id: fuente, cuenta_id: cuenta, comercio: null, avisos: [cuenta === 'cta-sant' ? 'santander' : 'bbva'], descripcion: 'SPEI recibido' });
    }
    // Aportaciones a metas de meses pasados (ya hechas en el banco).
    if (i > 0) {
      mov({ fecha: desdeLocal(anio, mes, 2, 10), monto_centavos: 360_000, tipo: 'interno', apartado_id: 'ap-viaje', comercio: 'Apartado Viaje', origen: 'manual' });
      mov({ fecha: desdeLocal(anio, mes, 2, 10, 5), monto_centavos: 240_000, tipo: 'interno', apartado_id: 'ap-ahorro', comercio: 'Apartado Ahorro', origen: 'manual' });
      mov({ fecha: desdeLocal(anio, mes, 2, 11), monto_centavos: 600_000, tipo: 'interno', cuenta_id: 'cta-sant', comercio: 'Traspaso a BBVA', avisos: ['santander'] });
    }
    for (const [comercio, categoria, min, max, veces] of COMERCIOS) {
      const n = Math.max(0, Math.round(veces * (0.7 + azar() * 0.6) * (ultimo / 30)));
      for (let k = 0; k < n; k++) {
        const dia = 1 + Math.floor(azar() * ultimo);
        const pesos = min === max ? min : min + azar() * (max - min);
        const wallet = azar() < 0.55;
        mov({
          fecha: desdeLocal(anio, mes, dia, 8 + Math.floor(azar() * 14), Math.floor(azar() * 60)),
          monto_centavos: Math.round(pesos * 100) - (min === max ? 0 : Math.floor(azar() * 100)),
          tipo: 'gasto',
          comercio,
          categoria_id: cat(categoria),
          cuenta_id: 'cta-bbva',
          apartado_id: 'ap-gastos',
          avisos: wallet ? ['wallet', 'bbva'] : ['bbva'],
          terminacion: '4821',
        });
      }
    }
  }
  t.movimientos!.sort((a, b) => Date.parse(String(b.fecha)) - Date.parse(String(a.fecha)));
  // Un gasto de hoy recién llegado por Wallet (aún sin el aviso del banco).
  mov({ fecha: new Date(ahora.getTime() - 25 * 60000), monto_centavos: 8_650, tipo: 'gasto', comercio: 'OXXO', categoria_id: cat('Súper'), cuenta_id: 'cta-bbva', apartado_id: 'ap-gastos', avisos: ['wallet'] });
  t.movimientos!.sort((a, b) => Date.parse(String(b.fecha)) - Date.parse(String(a.fecha)));

  // Por mover del mes en curso: lo que el ingreso principal manda a las metas.
  const ingreso = t.movimientos!.find((m) => m.fuente_id === 'f-principal' && periodoDe(String(m.fecha)) === actual);
  t.por_mover!.push(
    { id: 'pm1', ingreso_id: ingreso?.id ?? null, apartado_id: 'ap-viaje', periodo: actual, monto_centavos: 360_000, descripcion: 'Apartar $3,600 para Viaje', hecho_en: null, movimiento_id: null, creado_en: creado(3) },
    { id: 'pm2', ingreso_id: ingreso?.id ?? null, apartado_id: 'ap-ahorro', periodo: actual, monto_centavos: 240_000, descripcion: 'Apartar $2,400 para Ahorro', hecho_en: null, movimiento_id: null, creado_en: creado(3) },
    { id: 'pm3', ingreso_id: ingreso?.id ?? null, apartado_id: 'ap-gastos', periodo: actual, monto_centavos: 600_000, descripcion: 'Pasar $6,000 a BBVA', hecho_en: null, movimiento_id: null, creado_en: creado(3) },
  );
  t.notificaciones_crudas!.push(
    { id: 'n1', app: 'com.bancomer.mbanking', titulo: 'BBVA', texto: 'Tu operación por $1,250.00 fue autorizada. Consulta el detalle en la app.', texto_grande: null, publicada_en: creado(1), estado: 'por_revisar', resultado: null, movimiento_id: null },
    { id: 'n2', app: 'mx.bancosantander.supermovil', titulo: 'Santander', texto: 'Movimiento en tu cuenta ****7710 por $450.00', texto_grande: null, publicada_en: creado(2), estado: 'por_revisar', resultado: null, movimiento_id: null },
  );
  t.dispositivos!.push({ id: 'd1', nombre: 'Teléfono Android', revocado: false, ultimo_uso: new Date(ahora.getTime() - 25 * 60000).toISOString(), creado_en: creado(30) });
  return t;
}

type Filtro = (f: Fila) => boolean;

/** Constructor de consultas al estilo PostgREST, lo justo para lo que usa la app. */
class Consulta implements PromiseLike<{ data: unknown; error: null | { message: string } }> {
  private filtros: Filtro[] = [];
  private orden: Array<[string, boolean]> = [];
  private rango: [number, number] | null = null;
  private una = false;
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private datos: unknown = null;

  constructor(
    private tablas: Tablas,
    private tabla: string,
    private avisar: (tabla: string) => void,
  ) {}

  select() {
    return this;
  }
  insert(d: unknown) {
    this.op = 'insert';
    this.datos = d;
    return this;
  }
  update(d: unknown) {
    this.op = 'update';
    this.datos = d;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(c: string, v: unknown) {
    this.filtros.push((f) => f[c] === v);
    return this;
  }
  neq(c: string, v: unknown) {
    this.filtros.push((f) => f[c] !== v);
    return this;
  }
  gte(c: string, v: string) {
    this.filtros.push((f) => String(f[c]) >= v);
    return this;
  }
  lt(c: string, v: string) {
    this.filtros.push((f) => String(f[c]) < v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filtros.push((f) => vs.includes(f[c]));
    return this;
  }
  not(c: string, op: string, v: unknown) {
    if (op === 'is' && v === null) this.filtros.push((f) => f[c] != null);
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) {
    this.orden.push([c, o?.ascending !== false]);
    return this;
  }
  range(a: number, b: number) {
    this.rango = [a, b];
    return this;
  }
  limit(n: number) {
    this.rango = [0, n - 1];
    return this;
  }
  single() {
    this.una = true;
    return this;
  }

  private ejecutar(): unknown {
    const filas = (this.tablas[this.tabla] ??= []);
    const coincide = (f: Fila) => this.filtros.every((fn) => fn(f));
    if (this.op === 'insert') {
      const nuevas = (Array.isArray(this.datos) ? this.datos : [this.datos]).map((d) => ({ id: nuevoId(), creado_en: new Date().toISOString(), avisos: [], terminacion: null, ...(d as object) }) as Fila);
      if (this.tabla === 'movimientos') filas.unshift(...nuevas);
      else filas.push(...nuevas);
      this.avisar(this.tabla);
      return this.una ? nuevas[0] : nuevas;
    }
    if (this.op === 'update') {
      const cambiadas = filas.filter(coincide);
      for (const f of cambiadas) {
        Object.assign(f, this.datos);
        // Igual que el trigger de la base: aprender la categoría del comercio.
        const d = this.datos as Record<string, unknown>;
        if (this.tabla === 'movimientos' && d.categoria_id && f.comercio) {
          const patron = normalizarComercio(String(f.comercio));
          const reglas = this.tablas.reglas_categoria!;
          const existente = reglas.find((r) => r.patron === patron);
          if (existente) existente.categoria_id = d.categoria_id;
          else reglas.push({ id: nuevoId(), patron, categoria_id: d.categoria_id });
        }
      }
      this.avisar(this.tabla);
      return this.una ? (cambiadas[0] ?? null) : cambiadas;
    }
    if (this.op === 'delete') {
      this.tablas[this.tabla] = filas.filter((f) => !coincide(f));
      this.avisar(this.tabla);
      return null;
    }
    let r = filas.filter(coincide);
    const comparar = (x: unknown, y: unknown) => (typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0);
    for (const [c, asc] of [...this.orden].reverse()) r = [...r].sort((a, b) => comparar(a[c], b[c]) * (asc ? 1 : -1));
    if (this.rango) r = r.slice(this.rango[0], this.rango[1] + 1);
    return this.una ? (r[0] ?? null) : r.map((f) => ({ ...f }));
  }

  then<A, B>(ok?: ((v: { data: unknown; error: null | { message: string } }) => A | PromiseLike<A>) | null, mal?: ((e: unknown) => B | PromiseLike<B>) | null) {
    // Un poco de latencia para que se vean los estados de carga.
    return new Promise<{ data: unknown; error: null | { message: string } }>((res) =>
      setTimeout(() => {
        try {
          res({ data: this.ejecutar(), error: null });
        } catch (e) {
          res({ data: null, error: { message: e instanceof Error ? e.message : String(e) } });
        }
      }, 120),
    ).then(ok, mal);
  }
}

export function crearClienteDemo(): SupabaseClient {
  const tablas = demoVacia ? crearCuentaNueva() : crearDatos();
  const oyentes = new Map<string, Array<() => void>>();
  const avisar = (tabla: string) => setTimeout(() => oyentes.get(tabla)?.forEach((fn) => fn()), 50);
  const sesion = { access_token: 'demo', user: { id: 'demo', email: 'demo@finanzas.app' } };

  const cliente = {
    auth: {
      getSession: async () => ({ data: { session: sesion }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {
        salirDemo();
        return { error: null };
      },
    },
    from: (tabla: string) => new Consulta(tablas, tabla, avisar),
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      await new Promise((r) => setTimeout(r, 150));
      if (nombre === 'marcar_por_mover') {
        const p = tablas.por_mover!.find((x) => x.id === args.p_id);
        if (!p) return { data: null, error: { message: 'No se encontró el movimiento por hacer' } };
        if (args.p_hecho && !p.hecho_en) {
          // Igual que marcar_por_mover en la base: registra el movimiento interno.
          const apartado = tablas.apartados!.find((a) => a.id === p.apartado_id);
          const id = nuevoId();
          tablas.movimientos!.unshift({ id, fecha: new Date().toISOString(), monto_centavos: p.monto_centavos, tipo: 'interno', comercio: `Apartado ${apartado?.nombre ?? ''}`, descripcion: null, cuenta_id: null, categoria_id: null, apartado_id: p.apartado_id, fuente_id: null, origen: 'manual', estado: 'confirmado', avisos: [], terminacion: null });
          Object.assign(p, { hecho_en: new Date().toISOString(), movimiento_id: id });
        } else if (!args.p_hecho && p.hecho_en) {
          tablas.movimientos = tablas.movimientos!.filter((m) => m.id !== p.movimiento_id);
          Object.assign(p, { hecho_en: null, movimiento_id: null });
        }
        avisar('por_mover');
        avisar('movimientos');
        return { data: null, error: null };
      }
      if (nombre === 'registrar_dispositivo') return { data: 'llave-demo', error: null };
      return { data: null, error: { message: `Función ${nombre} no disponible en la demostración` } };
    },
    channel: () => {
      const canal = {
        on: (_tipo: string, filtro: { table: string }, fn: () => void) => {
          oyentes.set(filtro.table, [...(oyentes.get(filtro.table) ?? []), fn]);
          return canal;
        },
        subscribe: () => canal,
      };
      return canal;
    },
    removeChannel: async () => 'ok',
  };
  return cliente as unknown as SupabaseClient;
}
