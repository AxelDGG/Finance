import { useDatos, useResumen } from '@finanzas/api';
import { formatoMXN, porcentajeDe, porcentajeGastos } from '@finanzas/core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boton, Chip, Presionable, T, Tarjeta, TextoMetal } from '../../componentes/base';
import { BotonIcono, Encabezado } from '../../componentes/Encabezado';
import { Anillo, BarraProgreso, GraficaProyeccion, Segmentado } from '../../componentes/graficas';
import { IconoAjustes, IconoChevron } from '../../componentes/iconos';
import { useContador } from '../../componentes/useContador';
import { color, deslizar, suave } from '../../lib/tema';

export default function Apartados() {
  const insets = useSafeAreaInsets();
  const { config, cargando, recargar, acciones } = useDatos();
  const r = useResumen();
  const [metaSel, setMetaSel] = useState(0);
  const [punto, setPunto] = useState<number | null>(null);
  const [anchoGrafica, setAnchoGrafica] = useState(0);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});

  const meta = r.metas[Math.min(metaSel, Math.max(0, r.metas.length - 1))];
  const pct = useContador(meta ? meta.progreso.progreso * 100 : 0, 900);
  const proyeccion = meta?.proyeccion ?? [];
  const indiceHoy = Math.max(0, proyeccion.filter((p) => p.real).length - 1);
  const sel = punto != null && punto < proyeccion.length ? punto : indiceHoy;
  const puntoSel = proyeccion[sel];

  useEffect(() => setPunto(null), [metaSel]);

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => void recargar()} tintColor={color.acento} colors={[color.acento]} progressBackgroundColor={color.hoja} />}
      >
        <Encabezado
          eyebrow="Tus metas"
          titulo="APARTADOS"
          derecha={
            <BotonIcono etiqueta="Editar reglas y metas" onPress={() => router.push('/reglas')}>
              <IconoAjustes tamano={18} color={color.texto} />
            </BotonIcono>
          }
        />

        {r.metas.length === 0 ? (
          <Tarjeta style={{ padding: 22, gap: 12 }}>
            <T v="semi">Aún no tienes metas</T>
            <T v="tenue">Crea una meta (por ejemplo, un viaje o un fondo de emergencia) y decide qué parte de cada ingreso le toca.</T>
            <Boton titulo="Crear meta" onPress={() => router.push('/reglas')} />
          </Tarjeta>
        ) : (
          <>
            {r.metas.length > 1 && <Segmentado opciones={r.metas.map((m) => m.apartado.nombre)} valor={metaSel} onCambio={setMetaSel} />}

            {meta && (
              <Tarjeta retraso={80} style={{ padding: 22, alignItems: 'center', gap: 18 }}>
                <Anillo valor={meta.progreso.progreso} tamano={200} grosor={14} colorAnillo={meta.apartado.color} key={`anillo-${meta.apartado.id}`}>
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <TextoMetal tamano={54}>{`${Math.round(pct)}%`}</TextoMetal>
                    <T v="tenue" style={{ fontSize: 12 }}>
                      {meta.progreso.meta > 0 ? `de ${formatoMXN(meta.progreso.meta, { decimales: 'nunca' })}` : 'sin meta definida'}
                    </T>
                  </View>
                </Anillo>
                <Animated.View key={`nombre-${meta.apartado.id}`} entering={FadeIn.duration(400)} style={{ alignItems: 'center', gap: 6 }}>
                  <T v="semi" style={{ fontSize: 17 }}>{meta.apartado.nombre}</T>
                  {meta.apartado.destino ? <T v="tenue">{meta.apartado.destino}</T> : null}
                </Animated.View>
                <View style={{ flexDirection: 'row', width: '100%', paddingTop: 16, borderTopWidth: 1, borderTopColor: color.borde }}>
                  <Dato etiqueta="Llevas" valor={formatoMXN(meta.progreso.ahorrado, { decimales: 'nunca' })} />
                  <Dato etiqueta="Al mes" valor={formatoMXN(meta.progreso.aporte, { decimales: 'nunca' })} borde />
                  <Dato etiqueta="Llegas en" valor={meta.progreso.textoEstimado} acento />
                </View>
              </Tarjeta>
            )}

            {meta && proyeccion.length > 1 && (
              <Tarjeta retraso={140} style={{ padding: 20, gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ gap: 8 }}>
                    <T v="eyebrow">Proyección</T>
                    <Animated.View key={`m-${sel}-${meta.apartado.id}`} entering={FadeInDown.duration(suave.duration).easing(suave.easing)}>
                      <T v="display" style={{ fontSize: 28 }}>{formatoMXN(puntoSel?.acumulado ?? 0, { decimales: 'nunca' })}</T>
                    </Animated.View>
                  </View>
                  <Animated.View key={`e-${sel}-${meta.apartado.id}`} entering={FadeInDown.duration(suave.duration).easing(suave.easing)} style={{ alignItems: 'flex-end', gap: 8 }}>
                    <T v="tenue" style={{ fontSize: 12.5 }}>{puntoSel?.etiqueta}</T>
                    <Chip texto={puntoSel?.real ? 'Real' : 'Proyectado'} acento={!puntoSel?.real} />
                  </Animated.View>
                </View>
                <View onLayout={(e: LayoutChangeEvent) => setAnchoGrafica(e.nativeEvent.layout.width)}>
                  <GraficaProyeccion puntos={proyeccion} meta={meta.progreso.meta || proyeccion[proyeccion.length - 1]!.acumulado} seleccion={sel} onSeleccion={setPunto} ancho={anchoGrafica} colorLinea={meta.apartado.color} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T v="mono" style={{ fontSize: 10.5 }}>{proyeccion[0]?.etiqueta}</T>
                  <T v="mono" style={{ fontSize: 10.5, color: color.acentoClaro }}>hoy</T>
                  <T v="mono" style={{ fontSize: 10.5 }}>{proyeccion[proyeccion.length - 1]?.etiqueta}</T>
                </View>
              </Tarjeta>
            )}
          </>
        )}

        {r.gastos && (
          <Tarjeta retraso={200} style={{ padding: 20, gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="semi">{r.gastos.nombre}</T>
              <Chip texto={config.cuentas.find((c) => c.id === r.gastos?.cuenta_id)?.alias ?? 'Cuenta principal'} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <TextoMetal tamano={40}>{formatoMXN(Math.max(0, r.resumen.disponible), { decimales: 'nunca' })}</TextoMetal>
              <T v="tenue" style={{ fontSize: 12.5 }}>disponible de {formatoMXN(r.resumen.presupuesto, { decimales: 'nunca' })}</T>
            </View>
            <BarraProgreso valor={r.resumen.pctUsado / 100} />
          </Tarjeta>
        )}

        {r.porMoverMes.length > 0 && (
          <Tarjeta retraso={240} style={{ padding: 8 }}>
            <T v="eyebrow" style={{ padding: 12, paddingBottom: 4 }}>Por mover este mes</T>
            {r.porMoverMes.map((p) => (
              <Presionable key={p.id} onPress={() => void acciones.marcarPorMover(p.id, !p.hecho_en)} escala={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 56 }} accessibilityRole="checkbox" accessibilityState={{ checked: !!p.hecho_en }}>
                <Casilla marcada={!!p.hecho_en} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T style={{ textDecorationLine: p.hecho_en ? 'line-through' : 'none', color: p.hecho_en ? color.tenue : color.texto }}>{p.descripcion ?? formatoMXN(p.monto_centavos)}</T>
                  <T v="pequeno">{config.apartados.find((a) => a.id === p.apartado_id)?.destino ?? config.apartados.find((a) => a.id === p.apartado_id)?.nombre}</T>
                </View>
              </Presionable>
            ))}
          </Tarjeta>
        )}

        <Tarjeta retraso={280} style={{ padding: 8 }}>
          <T v="eyebrow" style={{ padding: 12, paddingBottom: 4 }}>Reglas de reparto</T>
          {config.fuentes.map((f) => {
            const abierta = !!abiertas[f.id];
            const partes = [
              ...(r.gastos ? [{ id: r.gastos.id, nombre: r.gastos.nombre, pct: porcentajeGastos(f.id, config.reglas, config.apartados), color: color.plata }] : []),
              ...r.metas.map((m) => ({ id: m.apartado.id, nombre: m.apartado.nombre, pct: porcentajeDe(f.id, m.apartado.id, config.reglas, config.apartados), color: m.apartado.color })),
            ].filter((p) => p.pct > 0);
            return (
              <View key={f.id}>
                <Presionable onPress={() => setAbiertas({ ...abiertas, [f.id]: !abierta })} escala={0.98} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, minHeight: 64 }} accessibilityRole="button" accessibilityState={{ expanded: abierta }}>
                  <View style={{ gap: 5 }}>
                    <T v="semi">{f.nombre}</T>
                    <T v="pequeno">
                      {formatoMXN(f.monto_esperado_centavos)} · llega a {config.cuentas.find((c) => c.id === f.cuenta_id)?.alias ?? '—'}
                    </T>
                  </View>
                  <Giro abierta={abierta} />
                </Presionable>
                {abierta && (
                  <Animated.View entering={FadeInDown.duration(suave.duration).easing(suave.easing)} style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 12 }}>
                    <View style={{ flexDirection: 'row', height: 12, borderRadius: 99, overflow: 'hidden', backgroundColor: color.pista }}>
                      {partes.map((p, i) => (
                        <Segmento key={p.id} ancho={p.pct} colorSeg={p.color} retraso={i * 120} />
                      ))}
                    </View>
                    {partes.map((p) => (
                      <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.color }} />
                          <T>{p.nombre}</T>
                        </View>
                        <T v="tenue">
                          <T v="semi" style={{ fontSize: 13.5 }}>{p.pct}%</T> · {formatoMXN(Math.round((f.monto_esperado_centavos * p.pct) / 100))}
                        </T>
                      </View>
                    ))}
                  </Animated.View>
                )}
              </View>
            );
          })}
          <Boton titulo="Editar reglas" variante="secundario" onPress={() => router.push('/reglas')} style={{ margin: 8 }} />
        </Tarjeta>
      </ScrollView>
    </View>
  );
}

function Dato({ etiqueta, valor, borde, acento }: { etiqueta: string; valor: string; borde?: boolean; acento?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6, borderLeftWidth: borde ? 1 : 0, borderRightWidth: borde ? 1 : 0, borderColor: color.borde }}>
      <T v="pequeno">{etiqueta}</T>
      <T v="semi" style={{ fontSize: 16, color: acento ? color.acentoTexto : color.texto }} numberOfLines={1}>
        {valor}
      </T>
    </View>
  );
}

function Segmento({ ancho, colorSeg, retraso }: { ancho: number; colorSeg: string; retraso: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      w.value = withTiming(ancho, deslizar);
    }, retraso);
    return () => clearTimeout(t);
  }, [ancho, retraso, w]);
  const estilo = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return <Animated.View style={[{ height: '100%', backgroundColor: colorSeg }, estilo]} />;
}

function Giro({ abierta }: { abierta: boolean }) {
  const g = useSharedValue(0);
  useEffect(() => {
    g.value = withTiming(abierta ? 180 : 0, suave);
  }, [abierta, g]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ rotate: `${g.value}deg` }] }));
  return (
    <Animated.View style={estilo}>
      <IconoChevron tamano={20} color={abierta ? color.acentoClaro : color.texto3} />
    </Animated.View>
  );
}

function Casilla({ marcada }: { marcada: boolean }) {
  const s = useSharedValue(marcada ? 1 : 0);
  useEffect(() => {
    s.value = withTiming(marcada ? 1 : 0, { duration: 250 });
  }, [marcada, s]);
  const relleno = useAnimatedStyle(() => ({ opacity: s.value, transform: [{ scale: 0.6 + s.value * 0.4 }] }));
  return (
    <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: marcada ? color.acento : 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ width: 26, height: 26, borderRadius: 13, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center' }, relleno]}>
        <T style={{ color: '#0A0B0D', fontSize: 14, fontFamily: 'Geist_600SemiBold' }}>✓</T>
      </Animated.View>
    </View>
  );
}
