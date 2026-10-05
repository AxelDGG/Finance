// Configuración de prueba (ficticia): BBVA para gastos, Santander donde
// llega el ingreso principal, metas de Viaje y Ahorro.
import type { Apartado, Categoria, ConfigUsuario, Movimiento, NotificacionEntrada } from '../src/index.ts';

export const BBVA = 'com.bancomer.mbanking';
export const SANTANDER = 'mx.bancosantander.supermovil';
export const WALLET = 'com.google.android.apps.walletnfcrel';

const categorias: Categoria[] = [
  'Comida', 'Súper', 'Transporte', 'Suscripciones', 'Entretenimiento', 'Salud', 'Servicios', 'Compras', 'Hogar', 'Transferencias', 'Otros',
].map((nombre, i) => ({ id: `cat-${nombre}`, nombre, color: '#888', orden: i }));

const apartados: Apartado[] = [
  { id: 'ap-gastos', nombre: 'Gastos personales', tipo: 'gastos', descripcion: null, cuenta_id: 'cta-bbva', destino: null, meta_centavos: null, saldo_inicial_centavos: 0, color: '#E2E3E7', orden: 0, archivado: false },
  { id: 'ap-viaje', nombre: 'Viaje', tipo: 'meta', descripcion: null, cuenta_id: null, destino: 'Apartado BBVA', meta_centavos: 3_600_000, saldo_inicial_centavos: 1_080_000, color: '#9A8DF2', orden: 1, archivado: false },
  { id: 'ap-ahorro', nombre: 'Ahorro', tipo: 'meta', descripcion: null, cuenta_id: null, destino: 'Cuenta de ahorro', meta_centavos: 3_000_000, saldo_inicial_centavos: 1_200_000, color: '#5E58A0', orden: 2, archivado: false },
];

export function config(): ConfigUsuario {
  return {
    cuentas: [
      { id: 'cta-bbva', banco: 'BBVA', alias: 'BBVA nómina', terminaciones: ['1234', '9876'], es_principal: true },
      { id: 'cta-sant', banco: 'Santander', alias: 'Santander', terminaciones: ['4321'], es_principal: false },
    ],
    fuentes: [
      { id: 'f-principal', nombre: 'Ingreso principal', cuenta_id: 'cta-sant', monto_esperado_centavos: 1_200_000, tolerancia_pct: 20, palabras_clave: [], activo: true },
      { id: 'f-secundario', nombre: 'Ingreso secundario', cuenta_id: 'cta-bbva', monto_esperado_centavos: 350_000, tolerancia_pct: 20, palabras_clave: [], activo: true },
    ],
    apartados,
    reglas: [
      { fuente_id: 'f-principal', apartado_id: 'ap-viaje', porcentaje: 30 },
      { fuente_id: 'f-principal', apartado_id: 'ap-ahorro', porcentaje: 20 },
    ],
    categorias,
    reglasCategoria: [],
  };
}

export function noti(app: string, titulo: string, texto: string, cuando = '2026-10-24T14:32:00-06:00'): NotificacionEntrada {
  return { app, titulo, texto, publicada_en: Date.parse(cuando) };
}

let siguiente = 1;
export function mov(parcial: Partial<Movimiento>): Movimiento {
  return {
    id: `m${siguiente++}`,
    fecha: '2026-10-24T20:32:00.000Z',
    monto_centavos: 10_000,
    tipo: 'gasto',
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
    ...parcial,
  };
}
