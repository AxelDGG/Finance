import { useDatos } from '@finanzas/api';
import { APPS, etiquetaDia, hora } from '@finanzas/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CapturaLocal, EstadoLector } from '../../modules/lector-notificaciones';
import { Boton, Chip, Presionable, T, Tarjeta } from '../componentes/base';
import { BotonIcono, Encabezado } from '../componentes/Encabezado';
import { IconoAtras, IconoCheck } from '../componentes/iconos';
import { Lector, lectorDisponible, vincularTelefono } from '../lib/lector';
import { color } from '../lib/tema';

const NOMBRE_APP = (app: string) => APPS[app]?.nombre ?? (app === 'com.android.shell' ? 'Prueba' : app);

export default function Captura() {
  const insets = useSafeAreaInsets();
  const { primera } = useLocalSearchParams<{ primera?: string }>();
  const { acciones } = useDatos();
  const [estado, setEstado] = useState<EstadoLector | null>(null);
  const [recientes, setRecientes] = useState<CapturaLocal[]>([]);
  const [vinculando, setVinculando] = useState(false);

  const refrescar = useCallback(() => {
    if (!lectorDisponible) return;
    setEstado(Lector.estado());
    setRecientes(Lector.recientes(40));
  }, []);

  useEffect(() => {
    refrescar();
    if (!lectorDisponible) return;
    const subs = [Lector.addListener('onCaptura', refrescar), Lector.addListener('onEnvio', refrescar)];
    // Al volver de los Ajustes de Android, revisamos si ya diste el permiso.
    const app = AppState.addEventListener('change', (s) => s === 'active' && refrescar());
    const intervalo = setInterval(refrescar, 4000);
    return () => {
      subs.forEach((s) => s.remove());
      app.remove();
      clearInterval(intervalo);
    };
  }, [refrescar]);

  const vincular = async () => {
    setVinculando(true);
    try {
      await vincularTelefono(acciones.registrarDispositivo);
      refrescar();
    } catch (e) {
      Alert.alert('No se pudo vincular', e instanceof Error ? e.message : String(e));
    } finally {
      setVinculando(false);
    }
  };

  if (!lectorDisponible) {
    return (
      <View style={{ flex: 1, backgroundColor: color.fondo, padding: 24, paddingTop: insets.top + 24 }}>
        <T>La captura automática solo funciona en la app de Android.</T>
      </View>
    );
  }

  const pasos = estado
    ? [
        {
          listo: estado.permiso,
          titulo: 'Acceso a notificaciones',
          texto: 'Permite que la app lea las notificaciones de BBVA, Santander y Google Wallet. Solo guarda las de esas tres apps.',
          accion: 'Dar permiso',
          hacer: () => Lector.abrirPermiso(),
        },
        {
          listo: estado.sinRestriccionBateria,
          titulo: 'Que Android no la duerma',
          texto:
            estado.fabricante.toLowerCase().includes('samsung')
              ? 'En tu Galaxy: permite el uso sin restricciones. Si aun así se detiene, ve a Ajustes › Batería › Límites de uso en segundo plano y agrega Finanzas a "Apps que nunca se suspenden".'
              : 'Permite que la app funcione en segundo plano sin restricciones de batería.',
          accion: 'Permitir',
          hacer: () => Lector.pedirSinRestriccionBateria() || Lector.abrirAjustesApp(),
          extra: estado.fabricante.toLowerCase().includes('samsung') ? { texto: 'Abrir ajustes de la app', hacer: () => Lector.abrirAjustesApp() } : undefined,
        },
        {
          listo: estado.puedeAvisar,
          titulo: 'Avisos de la app',
          texto: 'Para avisarte cuando llegue tu ingreso y qué te toca apartar.',
          accion: 'Permitir avisos',
          hacer: () => Lector.pedirPermisoAvisos(),
        },
        {
          listo: estado.configurado,
          titulo: 'Teléfono vinculado',
          texto: 'Conecta este teléfono con tu cuenta para enviar lo que capture.',
          accion: vinculando ? 'Vinculando…' : 'Vincular',
          hacer: () => void vincular(),
        },
      ]
    : [];
  const todoListo = pasos.length > 0 && pasos.every((p) => p.listo);

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <Encabezado
          eyebrow="Notificaciones del teléfono"
          titulo="CAPTURA"
          derecha={
            <BotonIcono etiqueta="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
              <IconoAtras tamano={18} color={color.texto} />
            </BotonIcono>
          }
        />

        {pasos.map((p, i) => (
          <Tarjeta key={p.titulo} retraso={60 + i * 60} style={{ padding: 16, gap: 12, borderColor: p.listo ? color.acentoBorde : color.borde }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: p.listo ? color.acento : 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', backgroundColor: p.listo ? color.acento : 'transparent' }}>
                {p.listo ? (
                  <Animated.View entering={ZoomIn.springify()}>
                    <IconoCheck tamano={16} color="#0A0B0D" />
                  </Animated.View>
                ) : (
                  <T v="mono" style={{ color: color.texto2 }}>{i + 1}</T>
                )}
              </View>
              <T v="semi" style={{ flex: 1 }}>{p.titulo}</T>
              {p.listo && <Chip texto="Listo" acento />}
            </View>
            {!p.listo && (
              <>
                <T v="tenue" style={{ lineHeight: 19 }}>{p.texto}</T>
                <Boton titulo={p.accion} onPress={p.hacer} />
                {'extra' in p && p.extra && <Boton titulo={p.extra.texto} variante="secundario" onPress={p.extra.hacer} />}
              </>
            )}
          </Tarjeta>
        ))}

        {estado && estado.android >= 35 && (
          <Tarjeta retraso={300} style={{ padding: 16, gap: 12, borderColor: estado.puedeLeerProtegidas ? color.acentoBorde : 'rgba(242,167,167,0.3)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: estado.puedeLeerProtegidas ? color.acento : 'rgba(242,167,167,0.6)', alignItems: 'center', justifyContent: 'center', backgroundColor: estado.puedeLeerProtegidas ? color.acento : 'transparent' }}>
                {estado.puedeLeerProtegidas ? <IconoCheck tamano={16} color="#0A0B0D" /> : <T v="mono" style={{ color: color.peligro }}>!</T>}
              </View>
              <T v="semi" style={{ flex: 1 }}>Avisos protegidos</T>
              {estado.puedeLeerProtegidas ? <Chip texto="Listo" acento /> : estado.ocultas > 0 ? <Chip texto={`${estado.ocultas} ocultos`} /> : null}
            </View>
            {!estado.puedeLeerProtegidas && (
              <>
                <T v="tenue" style={{ lineHeight: 19 }}>
                  Tu Android oculta el texto de las notificaciones que cree que traen un código, y a veces confunde los avisos de compra que mencionan la terminación de tu tarjeta. Esos avisos llegan a "Por revisar" con su hora, pero sin el monto.
                </T>
                <T v="tenue" style={{ lineHeight: 19 }}>
                  Para que la app los lea completos, conecta el teléfono a tu computadora (con depuración USB activada) y corre una sola vez:
                </T>
                <View style={{ padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: color.borde }}>
                  <T v="mono" selectable style={{ color: color.texto, fontSize: 11.5, lineHeight: 18 }}>
                    adb shell appops set {estado.paquete} RECEIVE_SENSITIVE_NOTIFICATIONS allow
                  </T>
                </View>
                <T v="pequeno">Después cierra y vuelve a abrir la app. Solo se hace una vez.</T>
              </>
            )}
          </Tarjeta>
        )}

        {todoListo && primera === '1' && (
          <Animated.View entering={FadeInDown.springify()}>
            <Boton titulo="¡Listo! Ir a mi inicio" onPress={() => router.replace('/')} style={{ minHeight: 54 }} />
          </Animated.View>
        )}

        {estado && (
          <Tarjeta retraso={320} style={{ padding: 18, gap: 10 }}>
            <T v="eyebrow">Estado</T>
            <Fila etiqueta="En espera de enviar" valor={String(estado.pendientes)} />
            <Fila etiqueta="Enviadas" valor={String(estado.enviadas)} />
            <Fila etiqueta="Última captura" valor={estado.ultimaCaptura ? `${etiquetaDia(estado.ultimaCaptura)} ${hora(estado.ultimaCaptura)}` : '—'} />
            <Fila etiqueta="Último envío" valor={estado.ultimoEnvio ? `${etiquetaDia(estado.ultimoEnvio)} ${hora(estado.ultimoEnvio)}` : '—'} />
            {estado.ultimoError ? <T style={{ color: color.peligro, fontSize: 13 }}>{estado.ultimoError}</T> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <Boton titulo="Enviar ahora" variante="secundario" onPress={() => { Lector.enviarAhora(); refrescar(); }} style={{ flex: 1 }} />
              <Boton titulo="Probar aviso" variante="secundario" onPress={() => Lector.avisoDePrueba('Así se ven los avisos', 'Llegó tu ingreso: te toca apartar $1,500 para tu meta')} style={{ flex: 1 }} />
            </View>
          </Tarjeta>
        )}

        <Tarjeta retraso={380} style={{ padding: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
            <T v="eyebrow">Bitácora del lector</T>
            <Presionable onPress={() => router.push('/revisar')} vibrar={false} style={{ minHeight: 40, justifyContent: 'center' }}>
              <T style={{ color: color.acentoClaro, fontSize: 13 }}>Por revisar</T>
            </Presionable>
          </View>
          {recientes.length === 0 ? (
            <T v="tenue" style={{ padding: 12 }}>Aún no se ha capturado nada. Haz un pago con tu tarjeta o con Google Wallet y aparecerá aquí.</T>
          ) : (
            recientes.map((c) => (
              <View key={c.id} style={{ padding: 12, gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T v="semi" style={{ fontSize: 13 }}>{NOMBRE_APP(c.app)}</T>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Chip texto={c.estado === 'enviada' ? c.resultado ?? 'enviada' : c.estado} acento={c.estado === 'enviada' && c.resultado === 'procesada'} />
                    <T v="mono" style={{ fontSize: 11 }}>{hora(c.publicadaEn)}</T>
                  </View>
                </View>
                {c.titulo ? <T style={{ fontSize: 13 }}>{c.titulo}</T> : null}
                {c.texto ? <T v="tenue" style={{ fontSize: 12.5 }} numberOfLines={3}>{c.texto}</T> : null}
              </View>
            ))
          )}
        </Tarjeta>
      </ScrollView>
    </View>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <T v="tenue">{etiqueta}</T>
      <T>{valor}</T>
    </View>
  );
}
