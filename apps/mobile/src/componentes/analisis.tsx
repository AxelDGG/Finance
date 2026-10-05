import type { CambioCategoria, Comercio, GastoPorCategoriaMeses, Recomendacion } from '@finanzas/core';
import { formatoMXN } from '@finanzas/core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { color } from '../lib/tema';
import { Avatar, Presionable, T, Tarjeta } from './base';
import { BarraProgreso, Segmentado } from './graficas';
import { IconoAlerta, IconoCheck, IconoDerecha } from './iconos';

const pesos = (c: number) => formatoMXN(c, { decimales: 'nunca' });

const ESTILO: Record<Recomendacion['nivel'], { fondo: string; tinta: string }> = {
  alerta: { fondo: 'rgba(242,167,167,0.12)', tinta: color.peligro },
  aviso: { fondo: color.acentoSuave, tinta: color.acentoClaro },
  idea: { fondo: 'rgba(255,255,255,0.06)', tinta: color.plata },
  bien: { fondo: color.acentoSuave, tinta: color.acentoClaro },
};

/** Recomendaciones del mes (mismas que en la web). */
export function Recomendaciones({ lista, retraso = 0 }: { lista: Recomendacion[]; retraso?: number }) {
  if (lista.length === 0) return null;
  return (
    <Tarjeta retraso={retraso} style={{ padding: 18, gap: 12 }}>
      <T v="eyebrow">Recomendaciones</T>
      {lista.map((r, i) => {
        const e = ESTILO[r.nivel];
        const accion = r.id === 'por-mover' || r.id.startsWith('meta-') ? () => router.navigate('/apartados') : undefined;
        const contenido = (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: e.fondo, alignItems: 'center', justifyContent: 'center' }}>
              {r.nivel === 'bien' ? <IconoCheck tamano={17} color={e.tinta} /> : <IconoAlerta tamano={17} color={e.tinta} />}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="semi" style={{ fontSize: 14, color: r.nivel === 'alerta' ? color.peligro : color.texto }}>{r.titulo}</T>
              <T v="pequeno" style={{ lineHeight: 18, color: color.texto2 }}>{r.texto}</T>
            </View>
            {accion && <IconoDerecha tamano={16} color={color.texto3} />}
          </View>
        );
        return (
          <Animated.View key={r.id} entering={FadeInDown.delay(retraso + 120 + i * 80).springify().damping(18)}>
            {accion ? (
              <Presionable onPress={accion} escala={0.98} vibrar={false} accessibilityRole="button" style={{ paddingVertical: 4 }}>
                {contenido}
              </Presionable>
            ) : (
              <View style={{ paddingVertical: 4 }}>{contenido}</View>
            )}
          </Animated.View>
        );
      })}
    </Tarjeta>
  );
}

/** Segmento de una barra apilada que crece al aparecer. */
function Segmento({ peso, fondo, retraso }: { peso: number; fondo: string; retraso: number }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(retraso, withTiming(peso, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [peso, retraso, s]);
  const estilo = useAnimatedStyle(() => ({ flexGrow: s.value }));
  return <Animated.View style={[{ height: '100%', backgroundColor: fondo, flexBasis: 0 }, estilo]} />;
}

function PorMes({ datos }: { datos: GastoPorCategoriaMeses }) {
  const maximo = Math.max(...datos.meses.map((m) => m.total), 1);
  return (
    <View style={{ gap: 12 }}>
      {datos.meses.map((m, i) => (
        <View key={m.periodo} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="pequeno" style={{ color: m.enCurso ? color.acentoTexto : color.texto2 }}>{m.etiqueta}</T>
            <T v="mono" style={{ fontSize: 11.5, color: color.texto }}>{pesos(m.total)}</T>
          </View>
          <View style={{ height: 12, borderRadius: 6, backgroundColor: color.pista, overflow: 'hidden' }}>
            <View style={{ width: `${(m.total / maximo) * 100}%`, height: '100%', flexDirection: 'row', gap: 1.5 }}>
              {datos.series.map((s) => (m.montos[s.clave] ? <Segmento key={s.clave} peso={m.montos[s.clave]!} fondo={s.color} retraso={i * 60} /> : null))}
            </View>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
        {datos.series.map((s) => (
          <View key={s.clave} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: s.color }} />
            <T v="pequeno">{s.nombre}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

function ContraMesPasado({ cambios }: { cambios: CambioCategoria[] }) {
  const lista = cambios.filter((c) => c.actual > 0 || c.anterior > 0).slice(0, 6);
  const maximo = Math.max(...lista.map((c) => Math.max(c.actual, c.anterior)), 1);
  if (lista.length === 0) return <T v="tenue">Aún no hay gastos para comparar.</T>;
  return (
    <View style={{ gap: 14 }}>
      {lista.map((c, i) => {
        const sube = c.cambioPct != null && c.cambioPct > 0;
        return (
          <View key={c.categoria_id ?? 'sin'} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T style={{ fontSize: 14 }}>{c.nombre}</T>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'baseline' }}>
                <T v="semi" style={{ fontSize: 14 }}>{pesos(c.actual)}</T>
                <T v="mono" style={{ fontSize: 11, color: c.cambioPct == null ? color.texto3 : sube ? color.peligro : color.acentoClaro }}>
                  {c.cambioPct == null ? 'nuevo' : `${sube ? '▲' : '▼'} ${Math.abs(Math.round(c.cambioPct))}%`}
                </T>
              </View>
            </View>
            <BarraProgreso valor={c.actual / maximo} colores={['#7A6CE0', '#CFC8FF']} retraso={100 + i * 60} />
            <BarraProgreso valor={c.anterior / maximo} colores={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.22)']} alto={4} retraso={160 + i * 60} />
          </View>
        );
      })}
      <T v="pequeno">Barra gruesa: este mes. Delgada: el mes pasado hasta el mismo día.</T>
    </View>
  );
}

function Comercios({ comercios }: { comercios: Comercio[] }) {
  const maximo = Math.max(...comercios.map((c) => c.total), 1);
  if (comercios.length === 0) return <T v="tenue">Aún no hay comercios este mes.</T>;
  return (
    <View style={{ gap: 12 }}>
      {comercios.map((c, i) => (
        <View key={c.clave} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar texto={c.nombre} tamano={38} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T numberOfLines={1} style={{ fontSize: 14, flexShrink: 1 }}>{c.nombre}</T>
              <T v="semi" style={{ fontSize: 14 }}>{pesos(c.total)}</T>
            </View>
            <BarraProgreso valor={c.total / maximo} alto={6} retraso={100 + i * 60} />
            <T v="pequeno">{c.veces} {c.veces === 1 ? 'vez' : 'veces'} este mes</T>
          </View>
        </View>
      ))}
    </View>
  );
}

/** "¿En qué se te va el dinero?" con tres vistas. */
export function EnQueSeVa({ porCategoriaMeses, cambios, comercios, retraso = 0 }: { porCategoriaMeses: GastoPorCategoriaMeses; cambios: CambioCategoria[]; comercios: Comercio[]; retraso?: number }) {
  const [vista, setVista] = useState(0);
  if (porCategoriaMeses.series.length === 0) return null;
  return (
    <Tarjeta retraso={retraso} style={{ padding: 18, gap: 16 }}>
      <T v="eyebrow">¿En qué se te va el dinero?</T>
      <Segmentado opciones={['Meses', 'Vs. mes pasado', 'Comercios']} valor={vista} onCambio={setVista} />
      <Animated.View key={vista} entering={FadeIn.duration(350)}>
        {vista === 0 && <PorMes datos={porCategoriaMeses} />}
        {vista === 1 && <ContraMesPasado cambios={cambios} />}
        {vista === 2 && <Comercios comercios={comercios} />}
      </Animated.View>
    </Tarjeta>
  );
}
