// Ejemplos SINTÉTICOS con las redacciones más comunes de bancos en México.
// Cuando el capturador junte notificaciones reales de tu teléfono, se
// agregan aquí como casos de prueba (ver muestras-reales.test.ts).
import { describe, expect, it } from 'vitest';
import { parsearNotificacion, resolverApp } from '../src/index.ts';
import { BBVA, noti, SANTANDER, WALLET } from './datos.ts';

describe('parsers · compras', () => {
  it.each([
    [BBVA, 'BBVA', 'Realizaste una compra por $86.50 en OXXO GUADALUPE con tu tarjeta terminación 1234.', 8650, 'OXXO GUADALUPE', '1234'],
    [BBVA, 'Compra aprobada', 'Compra de $1,234.56 MXN en AMAZON MX con tu tarjeta *9876 el 24/10/2026 a las 14:32', 123456, 'AMAZON MX', '9876'],
    [SANTANDER, 'Santander', 'Compra por $812.60 en COSTCO SATELITE con tarjeta de débito terminación 4321.', 81260, 'COSTCO SATELITE', '4321'],
    [SANTANDER, 'Cargo a tu cuenta', 'Se realizó un cargo de 129.00 MXN de SPOTIFY a tu tarjeta *4321', 12900, 'SPOTIFY', '4321'],
    [BBVA, 'BBVA', 'Pagaste $214.00 en DIDI FOOD con tu tarjeta digital •••• 1234', 21400, 'DIDI FOOD', '1234'],
    [SANTANDER, 'Santander', 'COMPRA APROBADA. Monto: $95.00 Comercio: FARMACIAS DEL AHORRO 22 Tarjeta: **4321', 9500, 'FARMACIAS DEL AHORRO', '4321'],
  ])('%s · %s', (app, titulo, texto, monto, comercio, terminacion) => {
    const e = parsearNotificacion(noti(app, titulo, texto))!;
    expect(e.tipo).toBe('compra');
    expect(e.monto_centavos).toBe(monto);
    expect(e.comercio).toBe(comercio);
    expect(e.terminacion).toBe(terminacion);
    expect(e.confianza).toBeGreaterThanOrEqual(0.7);
  });

  it('ignora el saldo que viene después del monto', () => {
    const e = parsearNotificacion(noti(BBVA, 'BBVA', 'Compra por $250.00 en CINEPOLIS. Saldo disponible: $5,320.10'))!;
    expect(e.monto_centavos).toBe(25000);
  });

  it('reconoce retiros de efectivo', () => {
    const e = parsearNotificacion(noti(BBVA, 'BBVA', 'Retiro en cajero automático por $1,000.00 con tu tarjeta *1234'))!;
    expect(e.tipo).toBe('retiro');
    expect(e.monto_centavos).toBe(100000);
    expect(e.comercio).toBe('Retiro de efectivo');
  });
});

describe('parsers · Google Wallet', () => {
  it('usa el título como comercio', () => {
    const e = parsearNotificacion(noti(WALLET, 'OXXO', '$86.50 con BBVA Visa •••• 1234'))!;
    expect(e.aviso).toBe('wallet');
    expect(e.tipo).toBe('compra');
    expect(e.monto_centavos).toBe(8650);
    expect(e.comercio).toBe('OXXO');
    expect(e.terminacion).toBe('1234');
    expect(e.banco).toBe('BBVA');
  });

  it('entiende MX$ y títulos genéricos', () => {
    const e = parsearNotificacion(noti(WALLET, 'Google Wallet', 'Pagaste MX$92.00 en Starbucks con Visa ••4321'))!;
    expect(e.monto_centavos).toBe(9200);
    expect(e.comercio).toBe('Starbucks');
    expect(e.terminacion).toBe('4321');
  });

  it('acepta comercios con números en el título', () => {
    expect(parsearNotificacion(noti(WALLET, 'OXXO 123', 'MX$19.50 con Visa **** 1234'))!.comercio).toBe('OXXO');
    expect(parsearNotificacion(noti(WALLET, '7-Eleven', '$45.00 con Visa **** 1234'))!.comercio).toBe('7-Eleven');
    expect(parsearNotificacion(noti(WALLET, '$45.00', 'Pago en Farmacia con Visa **** 1234'))!.comercio).toBe('Farmacia');
    // Un título que solo es el monto (sin "$") tampoco es el comercio.
    expect(parsearNotificacion(noti(WALLET, '86.50 MXN', 'Pago en Starbucks con Visa **** 1234'))!.comercio).toBe('Starbucks');
  });

  it('ignora avisos de Wallet sin monto', () => {
    const e = parsearNotificacion(noti(WALLET, 'Google Wallet', 'Tu tarjeta está lista para pagar con tu teléfono'))!;
    expect(e.tipo).toBe('ignorar');
  });
});

describe('parsers · transferencias', () => {
  it('ingreso recibido', () => {
    const e = parsearNotificacion(noti(SANTANDER, 'Santander', 'Recibiste una transferencia SPEI por $12,000.00 de EMPRESA DEMO SA DE CV en tu cuenta *4321'))!;
    expect(e.tipo).toBe('transferencia_recibida');
    expect(e.monto_centavos).toBe(1200000);
    expect(e.comercio).toBe('EMPRESA DEMO SA DE CV');
  });

  it('depósito', () => {
    const e = parsearNotificacion(noti(BBVA, 'BBVA', 'Te depositaron $3,500.00 en tu cuenta terminación 1234'))!;
    expect(e.tipo).toBe('transferencia_recibida');
    expect(e.monto_centavos).toBe(350000);
  });

  it('transferencia enviada con cuenta destino', () => {
    const e = parsearNotificacion(noti(SANTANDER, 'Transferencia enviada', 'Enviaste $6,000.00 a la cuenta *9876 desde tu cuenta *4321'))!;
    expect(e.tipo).toBe('transferencia_enviada');
    expect(e.monto_centavos).toBe(600000);
    expect(e.terminacion_destino).toBe('9876');
  });

  it('transferencia a una persona', () => {
    const e = parsearNotificacion(noti(BBVA, 'BBVA', 'Transferiste $350.00 a Juan Pérez. Concepto: tacos'))!;
    expect(e.tipo).toBe('transferencia_enviada');
    expect(e.comercio).toBe('Juan Pérez');
  });
});

describe('parsers · lo que se ignora', () => {
  it.each([
    ['Compra rechazada por $500.00 en AMAZON MX por fondos insuficientes'],
    ['Tu código de seguridad es 482913. No lo compartas.'],
    ['Iniciaste sesión en un nuevo dispositivo'],
    ['Aprovecha 6 meses sin intereses en Liverpool con tu tarjeta'],
    ['Tu estado de cuenta ya está disponible'],
  ])('%s', (texto) => {
    expect(parsearNotificacion(noti(BBVA, 'BBVA', texto))!.tipo).toBe('ignorar');
  });

  it('marca como desconocido si hay monto pero no se entiende', () => {
    const e = parsearNotificacion(noti(SANTANDER, 'Santander', 'Movimiento en tu cuenta por $300.00'))!;
    expect(e.tipo).toBe('desconocido');
    expect(e.monto_centavos).toBe(30000);
  });

  it('un aviso que Android ocultó queda por revisar (no se ignora)', () => {
    const e = parsearNotificacion(noti(BBVA, 'BBVA', 'Sensitive notification content hidden'))!;
    expect(e.tipo).toBe('desconocido');
    expect(e.motivo).toMatch(/ocult/);
    const es = parsearNotificacion(noti(SANTANDER, 'Santander', 'Contenido de notificación sensible oculto'))!;
    expect(es.tipo).toBe('desconocido');
  });

  it('devuelve null para apps que no escuchamos', () => {
    expect(parsearNotificacion(noti('com.whatsapp', 'Mamá', 'Compra $50 de tortillas'))).toBeNull();
  });
});

describe('modo de pruebas del emulador', () => {
  it('trata "[BBVA] ..." de com.android.shell como BBVA', () => {
    expect(resolverApp('com.android.shell', '[BBVA] Compra')).toEqual({ app: BBVA, titulo: 'Compra' });
    expect(resolverApp('com.android.shell', 'Otra cosa').app).toBe('com.android.shell');
    const e = parsearNotificacion(noti('com.android.shell', '[Wallet] OXXO', '$86.50 con Visa •••• 1234'))!;
    expect(e.aviso).toBe('wallet');
    expect(e.comercio).toBe('OXXO');
  });
});

describe('parsers · textos maliciosos', () => {
  it('no se cuelga con miles de espacios seguidos (ReDoS)', () => {
    const inicio = performance.now();
    const e = parsearNotificacion(noti(BBVA, 'BBVA', `Enviaste $100.00 a cuenta${' '.repeat(4000)}*1234`));
    expect(performance.now() - inicio).toBeLessThan(200);
    expect(e?.monto_centavos).toBe(10000);
  });
});
