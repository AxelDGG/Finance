import MaskedView from '@react-native-masked-view/masked-view';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { color, fuente, radio } from '../lib/tema';

// ---------------------------------------------------------------- texto

type Variante = 'cuerpo' | 'medio' | 'semi' | 'tenue' | 'pequeno' | 'eyebrow' | 'mono' | 'display';

const variantes: Record<Variante, TextStyle> = {
  cuerpo: { fontFamily: fuente.regular, fontSize: 14, color: color.texto },
  medio: { fontFamily: fuente.medio, fontSize: 14, color: color.texto },
  semi: { fontFamily: fuente.semi, fontSize: 15, color: color.texto },
  tenue: { fontFamily: fuente.regular, fontSize: 13, color: color.texto2 },
  pequeno: { fontFamily: fuente.regular, fontSize: 12, color: color.texto3 },
  eyebrow: { fontFamily: fuente.mono, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase', color: color.texto3 },
  mono: { fontFamily: fuente.mono, fontSize: 12, color: color.texto3 },
  display: { fontFamily: fuente.display, fontSize: 32, color: color.texto, includeFontPadding: false },
};

export function T({ v = 'cuerpo', style, ...props }: TextProps & { v?: Variante }) {
  return <Text {...props} style={[variantes[v], style]} />;
}

/** Texto con degradado plateado (blanco → plata → gris), como en el diseño. */
export function TextoMetal({ children, tamano = 40, style }: { children: ReactNode; tamano?: number; style?: StyleProp<TextStyle> }) {
  const estilo: TextStyle = { fontFamily: fuente.display, fontSize: tamano, lineHeight: tamano * 1.08, includeFontPadding: false };
  return (
    <MaskedView maskElement={<Text style={[estilo, style]}>{children}</Text>}>
      <LinearGradient colors={['#FFFFFF', '#D9DBE0', '#8B8F98']} locations={[0, 0.46, 1]}>
        <Text style={[estilo, style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

// ---------------------------------------------------------------- contenedores

export function Tarjeta({
  children,
  style,
  retraso = 0,
  sinEntrada = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  retraso?: number;
  sinEntrada?: boolean;
}) {
  return (
    <Animated.View entering={sinEntrada ? undefined : FadeInDown.delay(retraso).duration(650).springify().damping(18)} style={[estilos.tarjeta, style]}>
      <LinearGradient colors={[color.vidrio, color.vidrio2]} style={StyleSheet.absoluteFill} />
      {children}
    </Animated.View>
  );
}

export function Entrada({ children, retraso = 0, style }: { children: ReactNode; retraso?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(retraso).duration(600).springify().damping(18)} style={style}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------- interacción

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

/** Pressable que se encoge al tocarlo (con vibración ligera). */
export function Presionable({
  children,
  style,
  escala = 0.96,
  vibrar = true,
  onPress,
  ...props
}: PressableProps & { style?: StyleProp<ViewStyle>; escala?: number; vibrar?: boolean; children: ReactNode }) {
  const s = useSharedValue(1);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <PressableAnimado
      {...props}
      style={[style, animado]}
      onPressIn={(e) => {
        s.value = withTiming(escala, { duration: 110 });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, { damping: 12, stiffness: 260 });
        props.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (vibrar) void Haptics.selectionAsync();
        onPress?.(e);
      }}
    >
      {children}
    </PressableAnimado>
  );
}

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  icono,
  style,
  deshabilitado,
  cargando,
}: {
  titulo: string;
  onPress?: () => void;
  variante?: 'primario' | 'secundario' | 'fantasma';
  icono?: ReactNode;
  style?: StyleProp<ViewStyle>;
  deshabilitado?: boolean;
  cargando?: boolean;
}) {
  const primario = variante === 'primario';
  return (
    <Presionable
      onPress={deshabilitado || cargando ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!deshabilitado }}
      style={[
        estilos.boton,
        primario ? estilos.botonPrimario : variante === 'secundario' ? estilos.botonSecundario : null,
        (deshabilitado || cargando) && { opacity: 0.5 },
        style,
      ]}
    >
      {primario && <LinearGradient colors={['#F5F5F7', '#C4C7CE']} style={[StyleSheet.absoluteFill, { borderRadius: radio.boton }]} />}
      {icono}
      <Text style={{ fontFamily: fuente.semi, fontSize: 15, color: primario ? '#0A0B0D' : color.texto }}>{cargando ? 'Un momento…' : titulo}</Text>
    </Presionable>
  );
}

export function Chip({ texto, acento, style }: { texto: string; acento?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[estilos.chip, acento && estilos.chipAcento, style]}>
      <Text numberOfLines={1} style={{ fontFamily: fuente.medio, fontSize: 11.5, color: acento ? color.acentoTexto : '#A9ACB4' }}>
        {texto}
      </Text>
    </View>
  );
}

/** Chip que se puede elegir (categorías, cuentas). */
export function ChipElegible({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
  return (
    <Presionable
      onPress={onPress}
      escala={0.9}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={[estilos.chipElegible, activo && { backgroundColor: '#E9EAED', borderColor: '#E9EAED' }]}
    >
      <Text style={{ fontFamily: fuente.medio, fontSize: 13, color: activo ? '#0A0B0D' : '#BFC1C7' }}>{texto}</Text>
    </Presionable>
  );
}

export function Avatar({ texto, tamano = 42 }: { texto: string; tamano?: number }) {
  return (
    <View style={[estilos.avatar, { width: tamano, height: tamano, borderRadius: tamano * 0.31 }]}>
      <LinearGradient colors={['#25272D', '#17181C']} style={[StyleSheet.absoluteFill, { borderRadius: tamano * 0.31 }]} />
      <Text style={{ fontFamily: fuente.semi, fontSize: tamano * 0.36, color: '#D7D9DE' }}>{(texto.trim().charAt(0) || '·').toUpperCase()}</Text>
    </View>
  );
}

export const estilos = StyleSheet.create({
  tarjeta: {
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: color.borde,
    overflow: 'hidden',
    backgroundColor: '#0D0E11',
  },
  boton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radio.boton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  botonPrimario: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  botonSecundario: { borderWidth: 1, borderColor: color.borde, backgroundColor: color.vidrio },
  chip: {
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  chipAcento: { borderColor: color.acentoBorde, backgroundColor: 'rgba(154,141,242,0.10)' },
  chipElegible: {
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
  },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.borde, overflow: 'hidden' },
});
