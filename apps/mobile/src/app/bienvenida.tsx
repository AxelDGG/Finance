import { useDatos, type ConfiguracionInicial } from '@finanzas/api';
import type { Banco } from '@finanzas/core';
import { formatoMXN, leerMonto } from '@finanzas/core';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Boton, ChipElegible, T, Tarjeta, TextoMetal } from '../componentes/base';
import { Campo, CampoDinero, Pasos } from '../componentes/formulario';
import { Segmentado } from '../componentes/graficas';
import { color, paleta } from '../lib/tema';

type ClaveBanco = 'bbva' | 'santander';
const BANCOS: Array<{ clave: ClaveBanco; banco: Banco; nombre: string }> = [
  { clave: 'bbva', banco: 'BBVA', nombre: 'BBVA' },
  { clave: 'santander', banco: 'Santander', nombre: 'Santander' },
];

interface FuenteBorrador {
  nombre: string;
  monto: string;
  cuenta: ClaveBanco;
  reglas: Record<string, number>;
}
interface MetaBorrador {
  clave: string;
  nombre: string;
  meta: string;
  ahorrado: string;
  destino: string;
}

const PASOS = ['Cuentas', 'Ingresos', 'Metas', 'Reparto'];
const soloDigitos = (t: string) =>
  t
    .split(/[,\s]+/)
    .map((x) => x.replace(/\D/g, ''))
    .filter((x) => x.length === 4);

/** Asistente inicial. Empieza en blanco: tus datos se guardan en tu cuenta, no en el código. */
export default function Bienvenida() {
  const { sesion, configurado, listo, acciones } = useDatos();
  const insets = useSafeAreaInsets();
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [usados, setUsados] = useState<Record<ClaveBanco, boolean>>({ bbva: false, santander: false });
  const [terminaciones, setTerminaciones] = useState<Record<ClaveBanco, string>>({ bbva: '', santander: '' });
  const [cuentaGastos, setCuentaGastos] = useState<ClaveBanco>('bbva');
  const [fuentes, setFuentes] = useState<FuenteBorrador[]>([{ nombre: '', monto: '', cuenta: 'bbva', reglas: {} }]);
  const [metas, setMetas] = useState<MetaBorrador[]>([]);

  // "Atrás" del teléfono regresa al paso anterior en lugar de salir del asistente.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (paso > 0) setPaso(paso - 1);
      return true;
    });
    return () => sub.remove();
  }, [paso]);

  if (!sesion) return <Redirect href="/login" />;
  if (listo && configurado) return <Redirect href="/" />;

  const elegidos = BANCOS.filter((b) => usados[b.clave]);
  const opcionesBanco = elegidos.map((b) => b.nombre);
  const indiceBanco = (clave: ClaveBanco) => Math.max(0, elegidos.findIndex((b) => b.clave === clave));
  const fuentesValidas = fuentes.filter((f) => f.nombre.trim() && leerMonto(f.monto));
  const metasValidas = metas.filter((m) => m.nombre.trim());
  const cambiarFuente = (i: number, cambios: Partial<FuenteBorrador>) => setFuentes((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  const cambiarMeta = (i: number, cambios: Partial<MetaBorrador>) => setMetas((ms) => ms.map((m, j) => (j === i ? { ...m, ...cambios } : m)));

  const alternarBanco = (clave: ClaveBanco) => setUsados((antes) => ({ ...antes, [clave]: !antes[clave] }));
  // Si quitas un banco, lo que apuntaba a él pasa al primero que sí usas.
  const bancoValido = (clave: ClaveBanco): ClaveBanco => (usados[clave] ? clave : (elegidos[0]?.clave ?? clave));

  const terminar = async () => {
    const config: ConfiguracionInicial = {
      cuentas: elegidos.map((b) => ({ clave: b.clave, banco: b.banco, alias: b.nombre, terminaciones: soloDigitos(terminaciones[b.clave]), es_principal: bancoValido(cuentaGastos) === b.clave })),
      cuentaGastos: bancoValido(cuentaGastos),
      fuentes: fuentesValidas.map((f) => ({ nombre: f.nombre.trim(), cuenta: bancoValido(f.cuenta), monto_esperado_centavos: leerMonto(f.monto)!, reglas: f.reglas })),
      metas: metasValidas.map((m, i) => ({
        clave: m.clave,
        nombre: m.nombre.trim(),
        descripcion: null,
        meta_centavos: leerMonto(m.meta),
        saldo_inicial_centavos: leerMonto(m.ahorrado) ?? 0,
        destino: m.destino.trim() || null,
        color: paleta[i % 2 === 0 ? 0 : 4] ?? color.acento,
      })),
    };
    setGuardando(true);
    try {
      await acciones.aplicarConfiguracionInicial(config);
      router.replace('/captura?primera=1');
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  const siguiente = () => {
    if (paso === 0 && elegidos.length === 0) return Alert.alert('Elige tus bancos', 'Marca al menos un banco que uses.');
    if (paso === 1 && fuentesValidas.length === 0) return Alert.alert('Falta un ingreso', 'Agrega al menos un ingreso con su nombre y monto.');
    if (paso < PASOS.length - 1) setPaso(paso + 1);
    else void terminar();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <LinearGradient colors={['rgba(154,141,242,0.12)', 'transparent']} style={[StyleSheet.absoluteFill, { height: 320 }]} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <T v="eyebrow">
            Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}
          </T>
          <TextoMetal tamano={40}>CONFIGURA TU APP</TextoMetal>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            {PASOS.map((p, i) => (
              <Animated.View key={p} layout={LinearTransition.springify()} style={{ flex: i === paso ? 3 : 1, height: 4, borderRadius: 4, backgroundColor: i <= paso ? color.acento : color.pista }} />
            ))}
          </View>
        </View>

        <Animated.View key={paso} entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft.duration(150)} style={{ gap: 14 }}>
          {paso === 0 && (
            <>
              <T v="tenue" style={{ lineHeight: 20 }}>
                ¿Qué bancos usas? Finanzas lee los avisos de sus apps (y los de Google Wallet) para registrar tus pagos solos.
              </T>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {BANCOS.map((b) => (
                  <ChipElegible key={b.clave} texto={b.nombre} activo={usados[b.clave]} onPress={() => alternarBanco(b.clave)} />
                ))}
              </View>
              {elegidos.length > 0 && (
                <T v="tenue" style={{ lineHeight: 20 }}>
                  Escribe los últimos 4 dígitos de tus tarjetas o cuentas (opcional). Sirven para saber de qué cuenta salió cada pago. Puedes poner varios separados por coma.
                </T>
              )}
              {elegidos.map((b, i) => (
                <Tarjeta key={b.clave} style={{ padding: 18, gap: 14 }} retraso={i * 80}>
                  <T v="semi">{b.nombre}</T>
                  <Campo value={terminaciones[b.clave]} onChangeText={(t) => setTerminaciones({ ...terminaciones, [b.clave]: t })} placeholder="Ej. 1234, 5678" keyboardType="number-pad" etiqueta="Terminaciones" />
                </Tarjeta>
              ))}
              {elegidos.length > 1 && (
                <Tarjeta style={{ padding: 18, gap: 12 }} retraso={160}>
                  <T v="semi">¿Dónde está tu dinero para gastar?</T>
                  <T v="pequeno">Ahí vive "Gastos personales". Lo que llegue a la otra cuenta te pediremos pasarlo.</T>
                  <Segmentado opciones={opcionesBanco} valor={indiceBanco(bancoValido(cuentaGastos))} onCambio={(i) => setCuentaGastos(elegidos[i]!.clave)} />
                </Tarjeta>
              )}
            </>
          )}

          {paso === 1 && (
            <>
              <T v="tenue" style={{ lineHeight: 20 }}>
                Tus ingresos de cada mes y a qué cuenta llegan. Cuando llegue un depósito parecido, la app lo reconocerá y lo repartirá.
              </T>
              {fuentes.map((f, i) => (
                <Tarjeta key={i} style={{ padding: 18, gap: 14 }} retraso={i * 80}>
                  <Campo etiqueta="Nombre" value={f.nombre} onChangeText={(t) => cambiarFuente(i, { nombre: t })} placeholder="Ej. Sueldo" />
                  <CampoDinero etiqueta="Monto al mes" valor={f.monto} onCambio={(t) => cambiarFuente(i, { monto: t })} placeholder="0" />
                  {elegidos.length > 1 && (
                    <>
                      <T v="eyebrow">Llega a</T>
                      <Segmentado opciones={opcionesBanco} valor={indiceBanco(bancoValido(f.cuenta))} onCambio={(k) => cambiarFuente(i, { cuenta: elegidos[k]!.clave })} />
                    </>
                  )}
                  {fuentes.length > 1 && <Boton titulo="Quitar este ingreso" variante="fantasma" onPress={() => setFuentes((fs) => fs.filter((_, j) => j !== i))} />}
                </Tarjeta>
              ))}
              <Boton titulo="Agregar otro ingreso" variante="secundario" onPress={() => setFuentes((fs) => [...fs, { nombre: '', monto: '', cuenta: elegidos[0]?.clave ?? 'bbva', reglas: {} }])} />
            </>
          )}

          {paso === 2 && (
            <>
              <T v="tenue" style={{ lineHeight: 20 }}>
                Tus metas son apartados reales (otra cuenta o un apartado del banco). Pon cuánto quieres juntar y cuánto llevas hoy. Puedes saltarte este paso y agregarlas después.
              </T>
              {metas.map((m, i) => (
                <Tarjeta key={m.clave} style={{ padding: 18, gap: 14 }} retraso={i * 80}>
                  <Campo etiqueta="Nombre" value={m.nombre} onChangeText={(t) => cambiarMeta(i, { nombre: t })} placeholder="Ej. Viaje, fondo de emergencia" />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <CampoDinero etiqueta="Meta" valor={m.meta} onCambio={(t) => cambiarMeta(i, { meta: t })} placeholder="Opcional" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <CampoDinero etiqueta="Ya llevas" valor={m.ahorrado} onCambio={(t) => cambiarMeta(i, { ahorrado: t })} placeholder="0" />
                    </View>
                  </View>
                  <Campo etiqueta="¿Dónde está el dinero?" value={m.destino} onChangeText={(t) => cambiarMeta(i, { destino: t })} placeholder="Ej. Apartado del banco" />
                  <Boton titulo="Quitar esta meta" variante="fantasma" onPress={() => setMetas((ms) => ms.filter((_, j) => j !== i))} />
                </Tarjeta>
              ))}
              <Boton titulo="Agregar meta" variante="secundario" onPress={() => setMetas((ms) => [...ms, { clave: `meta${Date.now()}`, nombre: '', meta: '', ahorrado: '', destino: '' }])} />
            </>
          )}

          {paso === 3 && (
            <>
              <T v="tenue" style={{ lineHeight: 20 }}>
                {metasValidas.length > 0
                  ? 'Qué parte de cada ingreso va a cada meta. Lo que no apartes se queda en Gastos personales.'
                  : 'Sin metas por ahora: todo tu ingreso queda en Gastos personales. Puedes crear metas cuando quieras.'}
              </T>
              {fuentesValidas.map((f, i) => {
                const total = metasValidas.reduce((a, m) => a + (f.reglas[m.clave] ?? 0), 0);
                const monto = leerMonto(f.monto) ?? 0;
                const indice = fuentes.indexOf(f);
                return (
                  <Tarjeta key={i} style={{ padding: 18, gap: 14 }} retraso={i * 80}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <T v="semi">{f.nombre}</T>
                      <T v="tenue">{formatoMXN(monto)}</T>
                    </View>
                    {metasValidas.map((m) => {
                      const pct = f.reglas[m.clave] ?? 0;
                      return (
                        <View key={m.clave} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1 }}>
                            <T>{m.nombre}</T>
                            <T v="pequeno">{formatoMXN(Math.round((monto * pct) / 100))} al mes</T>
                          </View>
                          <Pasos valor={pct} maximo={100 - (total - pct)} onCambio={(v) => cambiarFuente(indice, { reglas: { ...f.reglas, [m.clave]: v } })} />
                        </View>
                      );
                    })}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.12)' }}>
                      <T>Gastos personales</T>
                      <T v="semi">
                        {100 - total}% · {formatoMXN(Math.round((monto * (100 - total)) / 100))}
                      </T>
                    </View>
                  </Tarjeta>
                );
              })}
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: insets.bottom + 16, flexDirection: 'row', gap: 10, backgroundColor: 'rgba(8,9,11,0.92)', borderTopWidth: 1, borderColor: color.borde }}>
        {paso > 0 && <Boton titulo="Atrás" variante="secundario" onPress={() => setPaso(paso - 1)} style={{ flex: 1 }} />}
        <Boton titulo={paso < PASOS.length - 1 ? 'Siguiente' : 'Terminar'} onPress={siguiente} cargando={guardando} style={{ flex: 2 }} />
      </View>
    </View>
  );
}
