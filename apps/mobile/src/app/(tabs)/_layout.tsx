import { useDatos } from '@finanzas/api';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Presionable } from '../../componentes/base';
import { AvisosProvider, useAviso } from '../../componentes/Aviso';
import { IconoApartados, IconoInicio, IconoMas, IconoMovimientos } from '../../componentes/iconos';
import { NuevoGasto } from '../../componentes/NuevoGasto';
import { color, fuente } from '../../lib/tema';

const PESTANAS = [
  { nombre: 'index', titulo: 'Inicio', Icono: IconoInicio },
  { nombre: 'movimientos', titulo: 'Movimientos', Icono: IconoMovimientos },
  { nombre: 'apartados', titulo: 'Apartados', Icono: IconoApartados },
] as const;

export default function LayoutPestanas() {
  const { iniciado, sesion, listo, configurado, error } = useDatos();

  if (!iniciado) return <Cargando />;
  if (!sesion) return <Redirect href="/login" />;
  if (!listo) return <Cargando />;
  if (!configurado && !error) return <Redirect href="/bienvenida" />;

  return (
    <AvisosProvider>
      <ContenidoPestanas />
    </AvisosProvider>
  );
}

function ContenidoPestanas() {
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const avisar = useAviso();
  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.fondo }, animation: 'shift' }} tabBar={(props) => <BarraPestanas {...props} onNuevo={() => setHojaAbierta(true)} />}>
        {PESTANAS.map((p) => (
          <Tabs.Screen key={p.nombre} name={p.nombre} options={{ title: p.titulo }} />
        ))}
      </Tabs>
      <NuevoGasto visible={hojaAbierta} onCerrar={() => setHojaAbierta(false)} onGuardado={(t) => avisar('Gasto registrado', t)} />
    </View>
  );
}

function BarraPestanas({ state, navigation, onNuevo }: BottomTabBarProps & { onNuevo: () => void }) {
  const insets = useSafeAreaInsets();
  const [ancho, setAncho] = useState(0);
  const x = useSharedValue(0);
  const anchoPestana = ancho > 0 ? (ancho - 14) / PESTANAS.length : 0;

  useEffect(() => {
    x.value = withSpring(state.index * anchoPestana, { damping: 15, stiffness: 170, mass: 0.8 });
  }, [state.index, anchoPestana, x]);
  const pastilla = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <Presionable
        onPress={onNuevo}
        escala={0.88}
        accessibilityRole="button"
        accessibilityLabel="Registrar gasto"
        style={[estilos.fab, { bottom: insets.bottom + 100 }]}
      >
        <LinearGradient colors={['#F6F6F8', '#BFC2C9']} style={[StyleSheet.absoluteFill, { borderRadius: 29 }]} />
        <IconoMas color="#0A0B0D" tamano={24} />
      </Presionable>

      <View onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)} style={[estilos.barra, { marginBottom: insets.bottom + 12 }]} accessibilityRole="tablist">
        <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: 'rgba(17,18,22,0.78)' }]} />
        {anchoPestana > 0 && (
          <Animated.View style={[estilos.pastilla, { width: anchoPestana }, pastilla]}>
            <LinearGradient colors={['rgba(154,141,242,0.28)', 'rgba(154,141,242,0.08)']} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
          </Animated.View>
        )}
        {PESTANAS.map((p, i) => {
          const activa = state.index === i;
          const ruta = state.routes[i];
          return (
            <Pressable
              key={p.nombre}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={p.titulo}
              onPress={() => {
                if (!ruta) return;
                const evento = navigation.emit({ type: 'tabPress', target: ruta.key, canPreventDefault: true });
                if (!activa && !evento.defaultPrevented) {
                  void Haptics.selectionAsync();
                  navigation.navigate(ruta.name);
                }
              }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <p.Icono color={activa ? color.acentoClaro : color.texto3} />
              <Text style={{ fontFamily: fuente.medio, fontSize: 11, color: activa ? color.blanco : color.texto3 }}>{p.titulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Cargando() {
  return (
    <View style={{ flex: 1, backgroundColor: color.fondo, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={color.acento} />
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    marginHorizontal: 16,
    height: 68,
    padding: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  pastilla: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(183,173,255,0.34)',
    overflow: 'hidden',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
    elevation: 8,
  },
});
