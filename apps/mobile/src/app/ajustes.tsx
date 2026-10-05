import { prefijoSobrante, useDatos } from '@finanzas/api';
import { esGasto, etiquetaDia, formatoMXN, hora, nombrePeriodo, periodoDe, presupuestoDelMes, sumarMeses } from '@finanzas/core';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boton, Chip, ChipElegible, Presionable, T, Tarjeta } from '../componentes/base';
import { BotonIcono, Encabezado } from '../componentes/Encabezado';
import { IconoAtras, IconoDerecha } from '../componentes/iconos';
import { estadoLector, lectorDisponible, revocarTelefono } from '../lib/lector';
import { supabase } from '../lib/supabase';
import { color } from '../lib/tema';

export default function Ajustes() {
  const insets = useSafeAreaInsets();
  const { sesion, config, movimientos, dispositivos, acciones, porMover } = useDatos();
  const [metaSobrante, setMetaSobrante] = useState<string | null>(null);
  const lector = lectorDisponible ? estadoLector() : null;

  // Cierre del mes pasado: lo que sobró de Gastos personales.
  const cierre = useMemo(() => {
    const anterior = sumarMeses(periodoDe(new Date()), -1);
    const movs = movimientos.filter((m) => periodoDe(m.fecha) === anterior);
    if (movs.length === 0) return null;
    const presupuesto = presupuestoDelMes(config, movs).total;
    const gastado = movs.filter(esGasto).reduce((a, m) => a + m.monto_centavos, 0);
    const yaPropuesto = porMover.some((p) => p.descripcion?.startsWith(prefijoSobrante(anterior)));
    return { periodo: anterior, sobrante: presupuesto - gastado, yaPropuesto };
  }, [movimientos, config, porMover]);

  const metas = config.apartados.filter((a) => a.tipo === 'meta' && !a.archivado);

  const enviarSobrante = async () => {
    const meta = metas.find((m) => m.id === metaSobrante);
    if (!meta || !cierre) return;
    try {
      await acciones.enviarSobranteAMeta(cierre.periodo, cierre.sobrante, meta);
      Alert.alert('Listo', `Agregamos "${formatoMXN(cierre.sobrante)} para ${meta.nombre}" a tus movimientos por hacer.`);
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : String(e));
    }
  };

  const cerrarSesion = () =>
    Alert.alert('¿Cerrar sesión?', 'El lector dejará de enviar notificaciones hasta que vuelvas a entrar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await revocarTelefono(acciones.revocarMiLlave);
          await supabase.auth.signOut();
          router.replace('/login');
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <Encabezado
          eyebrow={sesion?.user.email ?? ''}
          titulo="AJUSTES"
          derecha={
            <BotonIcono etiqueta="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
              <IconoAtras tamano={18} color={color.texto} />
            </BotonIcono>
          }
        />

        <Tarjeta retraso={40} style={{ padding: 6 }}>
          {lectorDisponible && (
            <Enlace titulo="Captura automática" detalle={lector?.permiso && lector.configurado ? 'Activa' : 'Necesita tu atención'} acento={!!(lector?.permiso && lector.configurado)} onPress={() => router.push('/captura')} />
          )}
          <Enlace titulo="Cuentas, ingresos y metas" detalle={`${config.fuentes.length} ingresos · ${metas.length} metas`} onPress={() => router.push('/reglas')} />
          <Enlace titulo="Por revisar" detalle="Notificaciones sin interpretar" onPress={() => router.push('/revisar')} />
        </Tarjeta>

        {cierre && (
          <Tarjeta retraso={100} style={{ padding: 18, gap: 12 }}>
            <T v="eyebrow">Cierre de {nombrePeriodo(cierre.periodo, true)}</T>
            {cierre.sobrante > 0 ? (
              <>
                <T style={{ lineHeight: 20 }}>
                  Te sobraron <T v="semi">{formatoMXN(cierre.sobrante)}</T> de Gastos personales. ¿Los mandas a una meta?
                </T>
                {cierre.yaPropuesto ? (
                  <Chip texto="Ya está en tus movimientos por hacer" acento />
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {metas.map((m) => (
                        <ChipElegible key={m.id} texto={m.nombre} activo={metaSobrante === m.id} onPress={() => setMetaSobrante(m.id)} />
                      ))}
                    </View>
                    <Boton titulo="Mandar a la meta" onPress={() => void enviarSobrante()} deshabilitado={!metaSobrante} />
                  </>
                )}
              </>
            ) : (
              <T v="tenue">Ese mes gastaste {formatoMXN(-cierre.sobrante)} más de tu presupuesto.</T>
            )}
          </Tarjeta>
        )}

        <Tarjeta retraso={160} style={{ padding: 18, gap: 12 }}>
          <T v="eyebrow">Teléfonos vinculados</T>
          {dispositivos.length === 0 ? (
            <T v="tenue">Ninguno todavía.</T>
          ) : (
            dispositivos.map((d) => (
              <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <T style={{ color: d.revocado ? color.tenue : color.texto }}>{d.nombre}</T>
                  <T v="pequeno">{d.revocado ? 'Desvinculado' : d.ultimo_uso ? `Último envío: ${etiquetaDia(d.ultimo_uso)} ${hora(d.ultimo_uso)}` : 'Sin envíos todavía'}</T>
                </View>
                {!d.revocado && (
                  <Boton
                    titulo="Quitar"
                    variante="secundario"
                    style={{ minHeight: 40 }}
                    onPress={() =>
                      Alert.alert('¿Desvincular este teléfono?', 'Ya no podrá mandar notificaciones a tu cuenta.', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Desvincular', style: 'destructive', onPress: () => void acciones.revocarDispositivo(d.id) },
                      ])
                    }
                  />
                )}
              </View>
            ))
          )}
        </Tarjeta>

        <Boton titulo="Cerrar sesión" variante="secundario" onPress={cerrarSesion} />
        <T v="pequeno" style={{ textAlign: 'center' }}>
          Finanzas {Constants.expoConfig?.version ?? ''} · tus datos solo los ves tú
        </T>
      </ScrollView>
    </View>
  );
}

function Enlace({ titulo, detalle, onPress, acento }: { titulo: string; detalle: string; onPress: () => void; acento?: boolean }): ReactNode {
  return (
    <Presionable onPress={onPress} escala={0.98} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 60 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <T v="semi">{titulo}</T>
        <T v="pequeno" style={{ color: acento ? color.acentoTexto : color.texto3 }}>{detalle}</T>
      </View>
      <IconoDerecha tamano={18} color={color.texto3} />
    </Presionable>
  );
}
