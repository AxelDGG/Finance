import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient as SvgGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { color, fuente } from '../lib/tema';

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

// ---------------------------------------------------------------- barra de progreso

export function BarraProgreso({
  valor,
  colores = ['#6F737D', '#E2E3E7'],
  alto = 8,
  retraso = 200,
  style,
}: {
  /** 0 a 1 */
  valor: number;
  colores?: [string, string];
  alto?: number;
  retraso?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ancho = useSharedValue(0);
  useEffect(() => {
    ancho.value = withDelay(retraso, withTiming(Math.max(0, Math.min(1, valor)), { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [valor, retraso, ancho]);
  const animado = useAnimatedStyle(() => ({ width: `${ancho.value * 100}%` }));
  return (
    <View style={[{ height: alto, borderRadius: 99, backgroundColor: color.pista, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height: '100%', borderRadius: 99, overflow: 'hidden' }, animado]}>
        <LinearGradient colors={colores} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- anillo

export function Anillo({
  valor,
  tamano = 64,
  grosor = 6,
  colorAnillo = color.acento,
  retraso = 300,
  children,
}: {
  valor: number;
  tamano?: number;
  grosor?: number;
  colorAnillo?: string;
  retraso?: number;
  children?: ReactNode;
}) {
  const r = (tamano - grosor) / 2;
  const circ = 2 * Math.PI * r;
  const progreso = useSharedValue(0);
  useEffect(() => {
    progreso.value = withDelay(retraso, withTiming(Math.max(0, Math.min(1, valor)), { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [valor, retraso, progreso]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - progreso.value) }));
  return (
    <View style={{ width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={tamano} height={tamano} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={tamano / 2} cy={tamano / 2} r={r} stroke={color.pista} strokeWidth={grosor} fill="none" />
        <CirculoAnimado
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          stroke={colorAnillo}
          strokeWidth={grosor}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={props}
        />
      </Svg>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- control segmentado

export function Segmentado({
  opciones,
  valor,
  onCambio,
  style,
}: {
  opciones: string[];
  valor: number;
  onCambio: (i: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [ancho, setAncho] = useState(0);
  const x = useSharedValue(0);
  // Ancho útil: sin bordes (2 × 1px) ni relleno (2 × 4px).
  const anchoOpcion = ancho > 0 ? (ancho - 10) / opciones.length : 0;
  useEffect(() => {
    x.value = withSpring(valor * anchoOpcion, { damping: 16, stiffness: 180 });
  }, [valor, anchoOpcion, x]);
  const pulgar = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)} style={[estilos.segmentado, style]} accessibilityRole="tablist">
      {anchoOpcion > 0 && (
        <Animated.View style={[estilos.pulgar, { width: anchoOpcion }, pulgar]}>
          <LinearGradient colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} />
        </Animated.View>
      )}
      {opciones.map((o, i) => (
        <Pressable
          key={o}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === valor }}
          onPress={() => {
            if (i !== valor) void Haptics.selectionAsync();
            onCambio(i);
          }}
          style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fuente.medio, fontSize: 13, color: i === valor ? color.blanco : '#9EA1A9' }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- gráfica de barras

export interface PuntoBarra {
  clave: string;
  corta: string;
  monto: number;
  etiqueta: string;
}

function Barra({ alto, activa, retraso, onPress, etiqueta }: { alto: number; activa: boolean; retraso: number; onPress: () => void; etiqueta: string }) {
  const h = useSharedValue(0);
  const brillo = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(retraso, withSpring(alto, { damping: 15, stiffness: 120 }));
  }, [alto, retraso, h]);
  useEffect(() => {
    brillo.value = withTiming(activa ? 1 : 0, { duration: 350 });
  }, [activa, brillo]);
  const estiloBarra = useAnimatedStyle(() => ({ height: `${h.value * 100}%`, opacity: 0.5 + brillo.value * 0.5 }));
  const estiloActivo = useAnimatedStyle(() => ({ opacity: brillo.value }));
  const estiloHalo = useAnimatedStyle(() => ({ opacity: brillo.value, transform: [{ scale: 0.4 + brillo.value * 0.6 }] }));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
      <Animated.View style={[estilos.halo, estiloHalo]} pointerEvents="none">
        <Svg width={90} height={40}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#9A8DF2" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#9A8DF2" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={45} cy={20} rx={45} ry={20} fill="url(#halo)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ width: '100%', borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, overflow: 'hidden' }, estiloBarra]}>
        <LinearGradient colors={['#4B4E57', '#24262C']} style={StyleSheet.absoluteFill} />
        <Animated.View style={[StyleSheet.absoluteFill, estiloActivo]}>
          <LinearGradient colors={['#C9C1FF', '#7A6CE0']} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** Barras que crecen al entrar; al tocar una se ilumina y se informa la selección. */
export function GraficaBarras({
  puntos,
  seleccion,
  onSeleccion,
  alto = 150,
  tope,
}: {
  puntos: PuntoBarra[];
  seleccion: number;
  onSeleccion: (i: number) => void;
  alto?: number;
  tope: number;
}) {
  return (
    <View>
      <View style={{ height: alto, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        {puntos.map((p, i) => (
          <Barra
            key={p.clave}
            alto={tope > 0 ? Math.max(0.02, p.monto / tope) : 0.02}
            activa={i === seleccion}
            retraso={150 + i * 60}
            etiqueta={p.etiqueta}
            onPress={() => {
              void Haptics.selectionAsync();
              onSeleccion(i);
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        {puntos.map((p, i) => (
          <Text key={p.clave} style={{ flex: 1, textAlign: 'center', fontFamily: fuente.medio, fontSize: 11.5, color: i === seleccion ? color.blanco : color.tenue }}>
            {p.corta}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- proyección de meta

export interface PuntoLinea {
  periodo: string;
  etiqueta: string;
  acumulado: number;
  real: boolean;
}

export function GraficaProyeccion({
  puntos,
  meta,
  seleccion,
  onSeleccion,
  ancho,
  alto = 150,
  colorLinea = color.acento,
}: {
  puntos: PuntoLinea[];
  meta: number;
  seleccion: number;
  onSeleccion: (i: number) => void;
  ancho: number;
  alto?: number;
  colorLinea?: string;
}) {
  const n = puntos.length;
  const x = (i: number) => (n <= 1 ? ancho / 2 : (i / (n - 1)) * ancho);
  const y = (v: number) => alto - 10 - (meta > 0 ? Math.min(1, v / meta) : 0) * (alto - 34);
  const reales = puntos.filter((p) => p.real);
  const ultimoReal = Math.max(0, reales.length - 1);
  const linea = (desde: number, hasta: number) =>
    puntos
      .slice(desde, hasta + 1)
      .map((p, k) => `${k ? 'L' : 'M'}${x(desde + k).toFixed(1)} ${y(p.acumulado).toFixed(1)}`)
      .join(' ');
  const area = `${linea(0, ultimoReal)} L${x(ultimoReal).toFixed(1)} ${alto} L0 ${alto} Z`;

  const mx = useSharedValue(x(seleccion));
  const my = useSharedValue(y(puntos[seleccion]?.acumulado ?? 0));
  useEffect(() => {
    mx.value = withSpring(x(seleccion), { damping: 14, stiffness: 160 });
    my.value = withSpring(y(puntos[seleccion]?.acumulado ?? 0), { damping: 14, stiffness: 160 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion, ancho, meta, n]);
  const marcador = useAnimatedStyle(() => ({ transform: [{ translateX: mx.value - 8 }, { translateY: my.value - 8 }] }));
  const guia = useAnimatedStyle(() => ({ transform: [{ translateX: mx.value }], top: my.value }));

  if (ancho <= 0 || n === 0) return <View style={{ height: alto }} />;
  return (
    <View style={{ width: ancho, height: alto }}>
      <Svg width={ancho} height={alto}>
        <Defs>
          <SvgGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colorLinea} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colorLinea} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        <Line x1={0} x2={ancho} y1={y(meta)} y2={y(meta)} stroke="rgba(255,255,255,0.16)" strokeDasharray="2 5" />
        <Path d={area} fill="url(#area)" />
        <Path d={linea(0, ultimoReal)} stroke="#B3A8FF" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {ultimoReal < n - 1 && <Path d={linea(ultimoReal, n - 1)} stroke={colorLinea} strokeWidth={2} fill="none" strokeDasharray="3 6" strokeLinecap="round" />}
      </Svg>
      <Animated.View pointerEvents="none" style={[estilos.guia, guia]} />
      <Animated.View pointerEvents="none" style={[estilos.marcador, { backgroundColor: color.acentoClaro }, marcador]} />
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        {puntos.map((p, i) => (
          <Pressable
            key={p.periodo}
            style={{ flex: 1 }}
            accessibilityLabel={`${p.etiqueta}`}
            onPress={() => {
              void Haptics.selectionAsync();
              onSeleccion(i);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  segmentado: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  pulgar: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  halo: {
    position: 'absolute',
    bottom: -20,
    width: 90,
    height: 40,
  },
  marcador: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#0E0F12',
  },
  guia: { position: 'absolute', left: 0, bottom: 0, width: 1, backgroundColor: 'rgba(183,173,255,0.4)' },
});
