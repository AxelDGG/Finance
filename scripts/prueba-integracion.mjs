// Prueba de punta a punta contra el proyecto real de Supabase:
//   teléfono (simulado) → función "ingesta" → base de datos.
//
// Usa un usuario de prueba (no tu cuenta). Ejecutar:
//   FINANZAS_PRUEBA_PASSWORD=... node scripts/prueba-integracion.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'https://ccqpwdctuaxllfrbxghj.supabase.co';
const LLAVE_PUBLICA = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_0etpyg9bIlDwPoU37tapsg_uJhpxUTM';
const EMAIL = process.env.FINANZAS_PRUEBA_EMAIL ?? 'prueba@finanzas.test';
const PASSWORD = process.env.FINANZAS_PRUEBA_PASSWORD;
if (!PASSWORD) throw new Error('Define FINANZAS_PRUEBA_PASSWORD');

let fallas = 0;
function revisar(condicion, mensaje, detalle) {
  if (condicion) console.log(`  ✓ ${mensaje}`);
  else {
    fallas++;
    console.log(`  ✗ ${mensaje}`, detalle !== undefined ? JSON.stringify(detalle) : '');
  }
}
const ok = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

const db = createClient(URL, LLAVE_PUBLICA, { auth: { persistSession: false } });
const anonimo = createClient(URL, LLAVE_PUBLICA, { auth: { persistSession: false } });

console.log('1) Sesión');
const { data: sesion, error: errSesion } = await db.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (errSesion) throw errSesion;
const uid = sesion.user.id;
revisar(!!sesion.session.access_token, 'inicia sesión el usuario de prueba');

console.log('2) Limpieza y configuración (con RLS)');
for (const t of ['por_mover', 'notificaciones_crudas', 'movimientos', 'reglas_reparto', 'fuentes_ingreso', 'reglas_categoria', 'dispositivos']) {
  ok(await db.from(t).delete().eq('user_id', uid));
}
ok(await db.from('apartados').delete().eq('user_id', uid).eq('tipo', 'meta'));
ok(await db.from('cuentas').delete().eq('user_id', uid));

const [bbva, sant] = ok(
  await db.from('cuentas').insert([
    { banco: 'BBVA', alias: 'BBVA', terminaciones: ['1234'], es_principal: true },
    { banco: 'Santander', alias: 'Santander', terminaciones: ['4321'], es_principal: false },
  ]).select('id,banco').order('banco'),
);
const gastos = ok(await db.from('apartados').update({ cuenta_id: bbva.id }).eq('user_id', uid).eq('tipo', 'gastos').select('id').single());
const [viaje, ahorro] = ok(
  await db.from('apartados').insert([
    { nombre: 'Viaje', tipo: 'meta', meta_centavos: 3_600_000, saldo_inicial_centavos: 1_080_000, orden: 1, destino: 'Apartado BBVA' },
    { nombre: 'Ahorro', tipo: 'meta', meta_centavos: 3_000_000, saldo_inicial_centavos: 1_200_000, orden: 2, destino: 'Cuenta de ahorro' },
  ]).select('id,nombre,orden').order('orden'),
);
const [principal] = ok(
  await db.from('fuentes_ingreso').insert([
    { nombre: 'Ingreso principal', cuenta_id: sant.id, monto_esperado_centavos: 1_200_000 },
    { nombre: 'Ingreso secundario', cuenta_id: bbva.id, monto_esperado_centavos: 350_000 },
  ]).select('id,nombre').order('nombre'),
);
ok(await db.from('reglas_reparto').insert([
  { fuente_id: principal.id, apartado_id: viaje.id, porcentaje: 30 },
  { fuente_id: principal.id, apartado_id: ahorro.id, porcentaje: 20 },
]));
const excedida = await db.from('reglas_reparto').upsert({ fuente_id: principal.id, apartado_id: viaje.id, porcentaje: 90 }, { onConflict: 'fuente_id,apartado_id' });
revisar(!!excedida.error, 'la base rechaza reglas que suman más de 100 %', excedida.error?.message);
revisar(!!gastos.id && !!viaje.id, 'configuración creada con RLS');

console.log('3) Seguridad');
const { data: ajenos } = await anonimo.from('movimientos').select('id');
revisar((ajenos ?? []).length === 0, 'sin sesión no se ve ningún movimiento');
const intruso = await anonimo.rpc('registrar_dispositivo', { p_nombre: 'intruso' });
revisar(!!intruso.error, 'sin sesión no se puede registrar un dispositivo');
const llave = ok(await db.rpc('registrar_dispositivo', { p_nombre: 'Emulador de prueba' }));
revisar(typeof llave === 'string' && llave.startsWith('fz_'), 'se registra el dispositivo y devuelve su llave');

const enviar = async (notificaciones, llaveUsada = llave) => {
  const r = await fetch(`${URL}/functions/v1/ingesta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-llave-dispositivo': llaveUsada },
    body: JSON.stringify({ notificaciones }),
  });
  return { status: r.status, cuerpo: await r.json() };
};

const sinLlave = await enviar([], 'fz_llave_falsa');
revisar(sinLlave.status === 401, 'una llave falsa es rechazada (401)', sinLlave);

console.log('4) Ingesta');
const t0 = Date.now() - 10 * 60_000;
const n = (app, titulo, texto, segundos) => ({ app, titulo, texto, publicada_en: t0 + segundos * 1000, clave: `prueba|${segundos}` });
const BBVA = 'com.bancomer.mbanking', SANT = 'mx.bancosantander.supermovil', WALLET = 'com.google.android.apps.walletnfcrel';

const r1 = await enviar([
  n(BBVA, 'BBVA', 'Compra por $86.50 en OXXO GUADALUPE con tu tarjeta *1234', 0),
  n(WALLET, 'OXXO', '$86.50 con Visa •••• 1234', 20),
  n(SANT, 'Santander', 'Recibiste una transferencia SPEI por $12,000.00 de EMPRESA DEMO SA DE CV', 60),
  n(BBVA, 'BBVA', 'Tu código de seguridad es 482913', 90),
  n(SANT, 'Santander', 'Movimiento en tu cuenta por $300.00', 120),
]);
revisar(r1.status === 200, 'la función responde 200', r1);
const estados = r1.cuerpo.resultados?.map((r) => r.estado);
revisar(JSON.stringify(estados) === JSON.stringify(['procesada', 'procesada', 'procesada', 'ignorada', 'por_revisar']), 'estados por notificación', estados);
revisar(r1.cuerpo.resultados?.[1]?.razon === 'wallet_y_banco', 'Wallet se junta con el aviso de BBVA', r1.cuerpo.resultados?.[1]);
const avisoIngreso = r1.cuerpo.avisos?.find((a) => a.titulo.includes('Ingreso principal'));
revisar(!!avisoIngreso && avisoIngreso.texto.includes('Apartar $3,600 para Viaje'), 'avisa qué apartar al llegar el ingreso', r1.cuerpo.avisos);

const r2 = await enviar([n(BBVA, 'BBVA', 'Compra por $86.50 en OXXO GUADALUPE con tu tarjeta *1234', 0)]);
revisar(r2.cuerpo.resultados?.[0]?.estado === 'duplicada', 'reenviar la misma notificación no la duplica', r2.cuerpo);

const r3 = await enviar([n(SANT, 'Santander', 'Transferiste $3,600.00 a la cuenta *5555', 180)]);
revisar(r3.cuerpo.resultados?.[0]?.tipo === 'interno', 'la transferencia de $3,600 se reconoce como apartado', r3.cuerpo);

console.log('5) Estado final en la base');
const movs = ok(await db.from('movimientos').select('tipo,monto_centavos,comercio,avisos,apartado_id,fuente_id,categoria_id').eq('user_id', uid).order('fecha'));
revisar(movs.length === 3, 'quedan 3 movimientos (gasto fusionado, ingreso, apartado)', movs);
const oxxo = movs.find((m) => m.monto_centavos === 8650);
revisar(oxxo?.comercio === 'OXXO' && oxxo.avisos.length === 2, 'el gasto de OXXO tiene 2 avisos y el nombre de Wallet', oxxo);
revisar(oxxo?.apartado_id === gastos.id && !!oxxo?.categoria_id, 'el gasto va a Gastos personales con categoría');
const ingreso = movs.find((m) => m.tipo === 'ingreso');
revisar(ingreso?.fuente_id === principal.id, 'el ingreso se asocia al Ingreso principal');
const pm = ok(await db.from('por_mover').select('monto_centavos,hecho_en,apartado_id,descripcion').eq('user_id', uid).order('monto_centavos', { ascending: false }));
revisar(pm.length === 3, 'se generan 3 "por mover" (BBVA, Viaje, Ahorro)', pm);
revisar(pm.find((p) => p.apartado_id === viaje.id)?.hecho_en != null, 'el de Viaje quedó hecho por la transferencia');
revisar(pm.filter((p) => p.hecho_en == null).length === 2, 'los otros dos siguen pendientes');

console.log('6) marcar_por_mover y reprocesar');
const pendienteAhorro = ok(await db.from('por_mover').select('id').eq('user_id', uid).eq('apartado_id', ahorro.id).single());
ok(await db.rpc('marcar_por_mover', { p_id: pendienteAhorro.id, p_hecho: true }));
const interno = ok(await db.from('movimientos').select('id,tipo,apartado_id').eq('user_id', uid).eq('apartado_id', ahorro.id));
revisar(interno.length === 1 && interno[0].tipo === 'interno', 'marcar como hecho crea el movimiento interno');
ok(await db.rpc('marcar_por_mover', { p_id: pendienteAhorro.id, p_hecho: false }));
const deshecho = ok(await db.from('movimientos').select('id').eq('user_id', uid).eq('apartado_id', ahorro.id));
revisar(deshecho.length === 0, 'desmarcarlo lo borra');

const rep = await fetch(`${URL}/functions/v1/ingesta/reprocesar`, { method: 'POST', headers: { Authorization: `Bearer ${sesion.session.access_token}` } });
const repCuerpo = await rep.json();
revisar(rep.status === 200 && repCuerpo.revisadas === 1 && repCuerpo.resumen?.por_revisar === 1, 'reprocesar revisa lo pendiente', repCuerpo);

console.log('7) Aprender categoría');
const comida = ok(await db.from('categorias').select('id').eq('user_id', uid).eq('nombre', 'Comida').single());
const movOxxo = ok(await db.from('movimientos').select('id').eq('user_id', uid).eq('monto_centavos', 8650).single());
ok(await db.from('movimientos').update({ categoria_id: comida.id }).eq('id', movOxxo.id));
const regla = ok(await db.from('reglas_categoria').select('patron,categoria_id').eq('user_id', uid));
revisar(regla.length === 1 && regla[0].patron === 'oxxo' && regla[0].categoria_id === comida.id, 'corregir la categoría crea la regla "oxxo → Comida"', regla);

console.log(fallas === 0 ? '\nTODO BIEN ✓' : `\n${fallas} FALLA(S) ✗`);
process.exit(fallas === 0 ? 0 : 1);
