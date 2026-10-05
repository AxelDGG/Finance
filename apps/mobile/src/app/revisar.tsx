import { lecturaDeNotificacion, useDatos } from '@finanzas/api';
import type { NotificacionCruda, TipoMovimiento } from '@finanzas/core';
import { APPS, etiquetaDia, formatoMXN, hora, leerMonto, resolverApp } from '@finanzas/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boton, Chip, ChipElegible, T, Tarjeta, TextoMetal } from '../componentes/base';
import { BotonIcono, Encabezado } from '../componentes/Encabezado';
import { Campo, CampoDinero } from '../componentes/formulario';
import { Segmentado } from '../componentes/graficas';
import { HojaInferior } from '../componentes/HojaInferior';
import { IconoAtras } from '../componentes/iconos';
import { color, deslizar } from '../lib/tema';

const TIPOS: TipoMovimiento[] = ['gasto', 'ingreso', 'interno'];

export default function Revisar() {
  const insets = useSafeAreaInsets();
  const { porRevisar, config, acciones, cargando, recargar } = useDatos();
  const [abierta, setAbierta] = useState<NotificacionCruda | null>(null);
  const [tipo, setTipo] = useState(0);
  const [monto, setMonto] = useState('');
  const [comercio, setComercio] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [reprocesando, setReprocesando] = useState(false);

  const abrir = (n: NotificacionCruda) => {
    const lectura = lecturaDeNotificacion(n);
    setAbierta(n);
    setTipo(lectura?.tipo === 'transferencia_recibida' ? 1 : 0);
    setMonto(lectura?.monto_centavos ? (lectura.monto_centavos / 100).toFixed(2) : '');
    setComercio(lectura?.comercio ?? '');
    setCategoria(null);
    const banco = APPS[resolverApp(n.app, n.titulo).app]?.banco;
    const idx = config.cuentas.findIndex((c) => c.banco === banco);
    setCuenta(idx >= 0 ? idx : 0);
  };

  const guardar = async () => {
    if (!abierta) return;
    const centavos = leerMonto(monto);
    if (!centavos) {
      Alert.alert('Falta el monto', 'Escribe el monto del movimiento.');
      return;
    }
    setGuardando(true);
    try {
      const t = TIPOS[tipo]!;
      await acciones.resolverNotificacion(abierta, {
        tipo: t,
        monto_centavos: centavos,
        comercio: comercio.trim() || null,
        categoria_id: t === 'gasto' ? categoria : null,
        cuenta_id: config.cuentas[cuenta]?.id ?? null,
        apartado_id: t === 'gasto' ? config.apartados.find((a) => a.tipo === 'gastos')?.id ?? null : null,
      });
      setAbierta(null);
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  const ignorar = async (n: NotificacionCruda) => {
    await acciones.resolverNotificacion(n, { ignorar: true });
    if (abierta?.id === n.id) setAbierta(null);
  };

  const reprocesar = async () => {
    setReprocesando(true);
    try {
      const r = await acciones.reprocesar();
      const procesadas = r.resumen.procesada ?? 0;
      Alert.alert('Listo', procesadas > 0 ? `Se entendieron ${procesadas} notificaciones más.` : 'Ninguna nueva se pudo interpretar todavía.');
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : String(e));
    } finally {
      setReprocesando(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, gap: 14 }}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => void recargar(['porRevisar'])} tintColor={color.acento} colors={[color.acento]} progressBackgroundColor={color.hoja} />}
      >
        <Encabezado
          eyebrow={`${porRevisar.length} ${porRevisar.length === 1 ? 'notificación' : 'notificaciones'}`}
          titulo="POR REVISAR"
          derecha={
            <BotonIcono etiqueta="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
              <IconoAtras tamano={18} color={color.texto} />
            </BotonIcono>
          }
        />
        <T v="tenue" style={{ lineHeight: 19 }}>
          Avisos de tus bancos que la app no supo interpretar sola. Dile qué fueron y la próxima vez lo hará mejor.
        </T>
        {porRevisar.length > 0 && <Boton titulo="Volver a intentar con todas" variante="secundario" onPress={() => void reprocesar()} cargando={reprocesando} />}

        {porRevisar.length === 0 ? (
          <Tarjeta style={{ padding: 22, alignItems: 'center', gap: 8 }}>
            <T v="semi">Todo en orden</T>
            <T v="tenue" style={{ textAlign: 'center' }}>No hay notificaciones pendientes de revisar.</T>
          </Tarjeta>
        ) : (
          porRevisar.map((n, i) => {
            const lectura = lecturaDeNotificacion(n);
            const app = APPS[resolverApp(n.app, n.titulo).app]?.nombre ?? n.app;
            return (
              <Animated.View key={n.id} exiting={FadeOutLeft} layout={LinearTransition.duration(deslizar.duration).easing(deslizar.easing)}>
                <Tarjeta retraso={i * 50} style={{ padding: 16, gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <T v="semi" style={{ fontSize: 14 }}>{app}</T>
                    <T v="mono" style={{ fontSize: 11 }}>
                      {etiquetaDia(n.publicada_en)} · {hora(n.publicada_en)}
                    </T>
                  </View>
                  {n.titulo ? <T style={{ fontSize: 13.5 }}>{n.titulo}</T> : null}
                  <T v="tenue" style={{ lineHeight: 19 }}>{n.texto_grande ?? n.texto}</T>
                  {lectura?.monto_centavos ? <Chip texto={`Monto leído: ${formatoMXN(lectura.monto_centavos)}`} acento /> : null}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Boton titulo="Ignorar" variante="secundario" onPress={() => void ignorar(n)} style={{ flex: 1 }} />
                    <Boton titulo="Registrar" onPress={() => abrir(n)} style={{ flex: 2 }} />
                  </View>
                </Tarjeta>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <HojaInferior visible={!!abierta} onCerrar={() => setAbierta(null)}>
        <TextoMetal tamano={30}>¿QUÉ FUE?</TextoMetal>
        <View style={{ marginTop: 16, gap: 16 }}>
          <Segmentado opciones={['Gasto', 'Ingreso', 'Entre cuentas']} valor={tipo} onCambio={setTipo} />
          <CampoDinero etiqueta="Monto" valor={monto} onCambio={setMonto} grande />
          <Campo etiqueta={tipo === 0 ? 'Comercio' : 'De / para'} value={comercio} onChangeText={setComercio} placeholder="Opcional" />
          {tipo === 0 && (
            <View style={{ gap: 10 }}>
              <T v="eyebrow">Categoría</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {config.categorias.map((c) => (
                  <ChipElegible key={c.id} texto={c.nombre} activo={categoria === c.id} onPress={() => setCategoria(c.id)} />
                ))}
              </View>
            </View>
          )}
          {config.cuentas.length > 0 && (
            <View style={{ gap: 10 }}>
              <T v="eyebrow">Cuenta</T>
              <Segmentado opciones={config.cuentas.map((c) => c.alias)} valor={cuenta} onCambio={setCuenta} />
            </View>
          )}
          <Boton titulo="Guardar" onPress={() => void guardar()} cargando={guardando} style={{ minHeight: 54 }} />
        </View>
      </HojaInferior>
    </View>
  );
}
