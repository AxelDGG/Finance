import { describe, expect, it } from 'vitest';
import { buscarFusion, clasificar, parsearNotificacion } from '../src/index.ts';
import { BBVA, config, mov, noti, SANTANDER, WALLET } from './datos.ts';

const clasificarTexto = (app: string, titulo: string, texto: string, cuando?: string) => {
  const e = parsearNotificacion(noti(app, titulo, texto, cuando))!;
  return { e, r: clasificar(e, config()) };
};

describe('clasificación', () => {
  it('una compra va a Gastos personales con categoría sugerida', () => {
    const { r } = clasificarTexto(BBVA, 'BBVA', 'Compra por $86.50 en OXXO GUADALUPE con tu tarjeta *1234');
    expect(r.estadoNotificacion).toBe('procesada');
    expect(r.movimiento).toMatchObject({ tipo: 'gasto', monto_centavos: 8650, apartado_id: 'ap-gastos', cuenta_id: 'cta-bbva', categoria_id: 'cat-Súper' });
  });

  it('aprende de tus reglas antes que de las predeterminadas', () => {
    const c = config();
    c.reglasCategoria = [{ patron: 'oxxo guadalupe', categoria_id: 'cat-Comida' }];
    const e = parsearNotificacion(noti(BBVA, 'BBVA', 'Compra por $86.50 en OXXO GUADALUPE con tu tarjeta *1234'))!;
    expect(clasificar(e, c).movimiento?.categoria_id).toBe('cat-Comida');
  });

  it('el depósito de $12,000 en Santander es el Ingreso principal', () => {
    const { r } = clasificarTexto(SANTANDER, 'Santander', 'Recibiste una transferencia SPEI por $12,000.00 de EMPRESA DEMO SA DE CV');
    expect(r.movimiento).toMatchObject({ tipo: 'ingreso', fuente_id: 'f-principal', cuenta_id: 'cta-sant' });
  });

  it('un depósito de $3,950 en BBVA es el Ingreso secundario (dentro de la tolerancia)', () => {
    const { r } = clasificarTexto(BBVA, 'BBVA', 'Te depositaron $3,950.00 en tu cuenta *1234');
    expect(r.movimiento).toMatchObject({ tipo: 'ingreso', fuente_id: 'f-secundario' });
  });

  it('un depósito que no coincide queda como ingreso extra', () => {
    const { r } = clasificarTexto(BBVA, 'BBVA', 'Te depositaron $500.00 en tu cuenta *1234');
    expect(r.movimiento).toMatchObject({ tipo: 'ingreso', fuente_id: null });
  });

  it('una transferencia a tu propia cuenta es movimiento interno', () => {
    const { r } = clasificarTexto(SANTANDER, 'Santander', 'Enviaste $6,000.00 a la cuenta *9876 desde tu cuenta *4321');
    expect(r.movimiento).toMatchObject({ tipo: 'interno', apartado_id: 'ap-gastos' });
  });

  it('una transferencia a otra persona es gasto de Transferencias', () => {
    const { r } = clasificarTexto(BBVA, 'BBVA', 'Transferiste $350.00 a Juan Pérez');
    expect(r.movimiento).toMatchObject({ tipo: 'gasto', categoria_id: 'cat-Transferencias' });
  });

  it('lo ilegible va a Por revisar y lo irrelevante se ignora', () => {
    expect(clasificarTexto(SANTANDER, 'Santander', 'Movimiento en tu cuenta por $300.00').r.estadoNotificacion).toBe('por_revisar');
    expect(clasificarTexto(BBVA, 'BBVA', 'Tu código de seguridad es 123456').r.estadoNotificacion).toBe('ignorada');
  });
});

describe('duplicados', () => {
  const propuesta = (app: string, titulo: string, texto: string, cuando: string) => {
    const e = parsearNotificacion(noti(app, titulo, texto, cuando))!;
    return { e, p: clasificar(e, config()).movimiento! };
  };

  it('junta el aviso de Wallet con el del banco (llega primero el banco)', () => {
    const banco = mov({ fecha: '2026-10-24T20:32:05.000Z', monto_centavos: 8650, comercio: 'OXXO GDL SUC', avisos: ['bbva'], cuenta_id: 'cta-bbva', categoria_id: 'cat-Súper' });
    const { e, p } = propuesta(WALLET, 'OXXO', '$86.50 con Visa •••• 1234', '2026-10-24T14:32:40-06:00');
    const f = buscarFusion(p, e.tipo, [banco])!;
    expect(f.razon).toBe('wallet_y_banco');
    expect(f.cambios.avisos?.sort()).toEqual(['bbva', 'wallet']);
    expect(f.cambios.comercio).toBe('OXXO'); // Wallet trae el nombre más limpio
    expect(f.cambios.cuenta_id).toBe('cta-bbva');
  });

  it('junta el aviso del banco con el de Wallet (llega primero Wallet)', () => {
    const wallet = mov({ fecha: '2026-10-24T20:32:00.000Z', monto_centavos: 8650, comercio: 'OXXO', avisos: ['wallet'] });
    const { e, p } = propuesta(BBVA, 'BBVA', 'Compra por $86.50 en OXXO GDL con tu tarjeta *1234', '2026-10-24T14:33:10-06:00');
    const f = buscarFusion(p, e.tipo, [wallet])!;
    expect(f.razon).toBe('wallet_y_banco');
    expect(f.cambios.comercio).toBe('OXXO');
    expect(f.cambios.cuenta_id).toBe('cta-bbva');
  });

  it('no junta montos distintos ni pagos separados por mucho tiempo', () => {
    const otro = mov({ fecha: '2026-10-24T20:32:00.000Z', monto_centavos: 9000, avisos: ['bbva'] });
    const tarde = mov({ fecha: '2026-10-24T22:00:00.000Z', monto_centavos: 8650, avisos: ['bbva'] });
    const { e, p } = propuesta(WALLET, 'OXXO', '$86.50 con Visa •••• 1234', '2026-10-24T14:32:40-06:00');
    expect(buscarFusion(p, e.tipo, [otro, tarde])).toBeNull();
  });

  it('detecta un aviso repetido de la misma app', () => {
    const previo = mov({ fecha: '2026-10-24T20:32:00.000Z', monto_centavos: 8650, avisos: ['bbva'], comercio: 'OXXO GDL' });
    const { e, p } = propuesta(BBVA, 'BBVA', 'Compra por $86.50 en OXXO GDL con tu tarjeta *1234', '2026-10-24T14:33:00-06:00');
    const f = buscarFusion(p, e.tipo, [previo])!;
    expect(f.razon).toBe('repetida');
    expect(f.cambios).toEqual({});
  });

  it('confirma un gasto que capturaste a mano', () => {
    const manual = mov({ fecha: '2026-10-24T18:00:00.000Z', monto_centavos: 8650, origen: 'manual', avisos: [], categoria_id: 'cat-Comida', comercio: 'Tacos' });
    const { e, p } = propuesta(BBVA, 'BBVA', 'Compra por $86.50 en TAQUERIA EL PASTOR con tu tarjeta *1234', '2026-10-24T14:32:00-06:00');
    const f = buscarFusion(p, e.tipo, [manual])!;
    expect(f.razon).toBe('confirma_manual');
    expect(f.cambios.categoria_id).toBe('cat-Comida'); // respeta tu categoría
    expect(f.cambios.comercio).toBe('Tacos');
  });

  it('un "por mover" marcado a mano se confirma con la transferencia del banco', () => {
    const marcado = mov({ fecha: '2026-10-23T18:00:00.000Z', monto_centavos: 360000, tipo: 'interno', origen: 'manual', avisos: [], apartado_id: 'ap-viaje', comercio: 'Apartado Viaje' });
    const { e, p } = propuesta(SANTANDER, 'Santander', 'Transferiste $3,600.00 a la cuenta *5555', '2026-10-23T12:05:00-06:00');
    expect(p.tipo).toBe('gasto'); // la cuenta *5555 no es conocida
    const f = buscarFusion(p, e.tipo, [marcado])!;
    expect(f.razon).toBe('confirma_manual');
  });

  it('junta los dos lados de un traspaso Santander → BBVA', () => {
    const salida = mov({ fecha: '2026-10-20T18:15:00.000Z', monto_centavos: 600000, tipo: 'gasto', avisos: ['santander'], categoria_id: 'cat-Transferencias' });
    const { e, p } = propuesta(BBVA, 'BBVA', 'Recibiste una transferencia por $6,000.00', '2026-10-20T12:17:00-06:00');
    expect(p.tipo).toBe('ingreso');
    const f = buscarFusion(p, e.tipo, [salida])!;
    expect(f.razon).toBe('traspaso_entre_cuentas');
    expect(f.cambios.tipo).toBe('interno');
    expect(f.cambios.categoria_id).toBeNull();
  });

  it('no confunde un ingreso real (con fuente) con un traspaso', () => {
    const salida = mov({ fecha: '2026-10-20T15:00:00.000Z', monto_centavos: 350000, tipo: 'gasto', avisos: ['santander'] });
    const { e, p } = propuesta(BBVA, 'BBVA', 'Te depositaron $3,500.00 en tu cuenta *1234', '2026-10-20T09:10:00-06:00');
    expect(p.fuente_id).toBe('f-secundario');
    expect(buscarFusion(p, e.tipo, [salida])).toBeNull();
  });
});
