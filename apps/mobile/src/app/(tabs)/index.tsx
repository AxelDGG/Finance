import { useDatos, useResumen } from '@finanzas/api';
import type { Movimiento } from '@finanzas/core';
import { escalaEje, formatoMXN, nombreDia, nombreMes, partes } from '@finanzas/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Boton, Chip, Entrada, Presionable, T, Tarjeta, TextoMetal } from '../../componentes/base';
import { BotonIcono, Encabezado } from '../../componentes/Encabezado';
import { EnQueSeVa, Recomendaciones } from '../../componentes/analisis';
import { Anillo, BarraProgreso, GraficaBarras } from '../../componentes/graficas';
import { IconoAjustes, IconoAlerta, IconoCampana, IconoCheck, IconoFlechas } from '../../componentes/iconos';
import { DetalleMovimiento, FilaMovimiento } from '../../componentes/movimientos';
import { useContador } from '../../componentes/useContador';
import { estadoLector, lectorDisponible } from '../../lib/lector';
import { color, deslizar } from '../../lib/tema';

export default function Inicio() {
  const insets = useSafeAreaInsets();
  const { movimientos, porRevisar, cargando, recargar, acciones, config } = useDatos();
  const r = useResumen();
  const [diaSel, setDiaSel] = useState(6);
  const [detalle, setDetalle] = useState<Movimiento | null>(null);
  const [lectorOk, setLectorOk] = useState(true);

  const revisarLector = useCallback(() => {
    if (lectorDisponible) {
      const e = estadoLector();
      setLectorOk(e.permiso && e.configurado);
    }
  }, []);
  useFocusEffect(revisarLector);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && revisarLector());
    return () => sub.remove();
  }, [revisarLector]);

  const disponible = useContador(r.resumen.disponible);
  const ahora = partes(new Date());
  const dias = r.series.dias;
  const { tope } = escalaEje(Math.max(...dias.map((d) => d.monto), 1));
  const totalSemana = useContador(dias.reduce((a, d) => a + d.monto, 0));
  const dia = dias[Math.min(diaSel, dias.length - 1)];
  const recientes = movimientos.slice(0, 5);
  const gastos = r.gastos;

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => void recargar()} tintColor={color.acento} colors={[color.acento]} progressBackgroundColor={color.hoja} />}
      >
        <Encabezado
          eyebrow={`${nombreDia(ahora.diaSemana, true)} ${ahora.dia} · ${nombreMes(ahora.mes, true)}`}
          titulo="INICIO"
          derecha={
            <>
              <BotonIcono etiqueta="Por revisar" onPress={() => router.push('/revisar')} punto={porRevisar.length}>
                <IconoCampana tamano={18} color={color.texto} />
              </BotonIcono>
              <BotonIcono etiqueta="Ajustes" onPress={() => router.push('/ajustes')}>
                <IconoAjustes tamano={18} color={color.texto} />
              </BotonIcono>
            </>
          }
        />

        {/* Disponible para gastar */}
        <Tarjeta retraso={60} style={{ padding: 22, gap: 16 }}>
          <Destello />
          <T v="eyebrow">{r.resumen.disponible >= 0 ? 'Disponible para gastar' : 'Te pasaste del presupuesto'}</T>
          <TextoMetal tamano={68}>{`${r.resumen.disponible < 0 ? '−' : ''}${formatoMXN(Math.round(Math.abs(disponible)), { decimales: 'nunca' })}`}</TextoMetal>
          <BarraProgreso valor={r.resumen.pctUsado / 100} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="tenue" style={{ fontSize: 12.5 }}>
              Gastado {formatoMXN(r.resumen.gastado, { decimales: 'nunca' })} de {formatoMXN(r.resumen.presupuesto, { decimales: 'nunca' })}
            </T>
            <T v="mono" style={{ color: color.texto2 }}>{Math.round(r.resumen.pctUsado)}%</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip texto={r.resumen.porDia > 0 ? `≈ ${formatoMXN(r.resumen.porDia, { decimales: 'nunca' })} por día` : 'Sin margen este mes'} acento />
            <Chip texto={`Quedan ${r.resumen.diasRestantes} días`} />
          </View>
        </Tarjeta>

        {/* Captura automática apagada */}
        {lectorDisponible && !lectorOk && (
          <Tarjeta retraso={100} style={{ padding: 16 }}>
            <Presionable onPress={() => router.push('/captura')} vibrar={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[estilos.icono, { backgroundColor: 'rgba(242,167,167,0.12)' }]}>
                <IconoAlerta tamano={20} color={color.peligro} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T v="semi" style={{ fontSize: 14 }}>Activa la captura automática</T>
                <T v="pequeno">Sin ella tus pagos no se registran solos.</T>
              </View>
              <Chip texto="Activar" acento />
            </Presionable>
          </Tarjeta>
        )}

        {/* Por mover */}
        {r.pendientesPorMover.length > 0 && (
          <Animated.View layout={LinearTransition.duration(deslizar.duration).easing(deslizar.easing)} style={{ gap: 10 }}>
            {r.pendientesPorMover.map((p, i) => {
              const apartado = config.apartados.find((a) => a.id === p.apartado_id)?.nombre ?? 'Apartado';
              return (
                <Animated.View key={p.id} exiting={FadeOutLeft.duration(300)} layout={LinearTransition.duration(deslizar.duration).easing(deslizar.easing)}>
                  <Tarjeta retraso={120 + i * 60} style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={estilos.icono}>
                        <IconoFlechas tamano={20} color={color.acentoClaro} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <T v="semi" style={{ fontSize: 14 }}>{p.descripcion ?? `Apartar ${formatoMXN(p.monto_centavos)}`}</T>
                        <T v="pequeno">{apartado} · {r.porMoverMes.filter((x) => x.hecho_en).length} de {r.porMoverMes.length} hechos</T>
                      </View>
                      <Boton titulo="Ya lo hice" onPress={() => void acciones.marcarPorMover(p.id, true)} style={{ minHeight: 44, paddingHorizontal: 14 }} />
                    </View>
                  </Tarjeta>
                </Animated.View>
              );
            })}
          </Animated.View>
        )}
        {r.pendientesPorMover.length === 0 && r.porMoverMes.length > 0 && (
          <Tarjeta retraso={120} style={{ padding: 14, borderColor: color.acentoBorde }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[estilos.icono, { backgroundColor: color.acento }]}>
                <IconoCheck tamano={20} color="#0A0B0D" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T v="semi" style={{ fontSize: 14 }}>Apartados al día</T>
                <T v="pequeno">{r.porMoverMes.length} de {r.porMoverMes.length} movimientos hechos este mes</T>
              </View>
            </View>
          </Tarjeta>
        )}

        {/* Esta semana */}
        <Tarjeta retraso={180} style={{ padding: 20, gap: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 8 }}>
              <T v="eyebrow">Esta semana</T>
              <T v="display" style={{ fontSize: 30 }}>{formatoMXN(Math.round(totalSemana), { decimales: 'nunca' })}</T>
            </View>
            {dia && (
              <Animated.View key={dia.clave} entering={FadeIn.duration(350)} style={{ alignItems: 'flex-end', gap: 6 }}>
                <T v="tenue" style={{ fontSize: 12 }}>{dia.etiqueta}</T>
                <T v="semi" style={{ fontSize: 19, color: color.blanco }}>
                  {formatoMXN(dia.monto)} · {dia.cantidad} {dia.cantidad === 1 ? 'mov.' : 'movs.'}
                </T>
              </Animated.View>
            )}
          </View>
          <GraficaBarras puntos={dias} seleccion={diaSel} onSeleccion={setDiaSel} tope={tope} />
        </Tarjeta>

        {/* Recomendaciones y en qué se va el dinero */}
        <Recomendaciones lista={r.analisis.recomendaciones} retraso={200} />
        <EnQueSeVa porCategoriaMeses={r.analisis.porCategoriaMeses} cambios={r.analisis.cambiosCategoria} comercios={r.analisis.comercios} retraso={220} />

        {/* Apartados */}
        <Entrada retraso={240} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
            <T v="eyebrow">Apartados</T>
            <Presionable onPress={() => router.navigate('/apartados')} vibrar={false} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T style={{ color: color.acentoClaro, fontSize: 13 }}>Ver todos</T>
            </Presionable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 8 }} style={{ marginHorizontal: -16 }}>
            {gastos && (
              <TarjetaApartado
                nombre={gastos.nombre}
                valor={Math.max(0, r.resumen.disponible) / Math.max(1, r.resumen.presupuesto)}
                monto={formatoMXN(Math.max(0, r.resumen.disponible), { decimales: 'nunca' })}
                sub={`disponible de ${formatoMXN(r.resumen.presupuesto, { decimales: 'nunca' })}`}
                colorAnillo={color.plata}
              />
            )}
            {r.metas.map((m) => (
              <TarjetaApartado
                key={m.apartado.id}
                nombre={m.apartado.nombre}
                valor={m.progreso.progreso}
                monto={formatoMXN(m.progreso.ahorrado, { decimales: 'nunca' })}
                sub={m.progreso.meta > 0 ? `de ${formatoMXN(m.progreso.meta, { decimales: 'nunca' })} · ${m.progreso.textoEstimado}` : 'Sin meta definida'}
                colorAnillo={m.apartado.color}
              />
            ))}
          </ScrollView>
        </Entrada>

        {/* Últimos movimientos */}
        <Tarjeta retraso={300} style={{ paddingVertical: 12, paddingHorizontal: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 }}>
            <T v="eyebrow">Últimos movimientos</T>
            <Presionable onPress={() => router.navigate('/movimientos')} vibrar={false} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T style={{ color: color.acentoClaro, fontSize: 13 }}>Ver todos</T>
            </Presionable>
          </View>
          {recientes.length === 0 ? (
            <T v="tenue" style={{ padding: 16, textAlign: 'center' }}>
              Aún no hay movimientos. Cuando pagues con tu tarjeta aparecerán aquí solos.
            </T>
          ) : (
            recientes.map((m) => <FilaMovimiento key={m.id} m={m} onPress={() => setDetalle(m)} />)
          )}
        </Tarjeta>
      </ScrollView>
      <DetalleMovimiento m={detalle} onCerrar={() => setDetalle(null)} />
    </View>
  );
}

function TarjetaApartado({ nombre, valor, monto, sub, colorAnillo }: { nombre: string; valor: number; monto: string; sub: string; colorAnillo: string }) {
  return (
    <Presionable onPress={() => router.navigate('/apartados')} escala={0.96}>
      <Tarjeta sinEntrada style={{ width: 172, padding: 16, gap: 14 }}>
        <Anillo valor={valor} colorAnillo={colorAnillo}>
          <T v="mono" style={{ color: color.texto, fontSize: 12 }}>{Math.round(valor * 100)}%</T>
        </Anillo>
        <View style={{ gap: 5 }}>
          <T v="tenue">{nombre}</T>
          <T v="display" style={{ fontSize: 24 }}>{monto}</T>
          <T v="pequeno" numberOfLines={2}>{sub}</T>
        </View>
      </Tarjeta>
    </Presionable>
  );
}

function Destello() {
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', right: -96, top: -100 }}>
        <Svg width={220} height={220}>
          <Circle cx={110} cy={110} r={102} stroke="rgba(255,255,255,0.12)" strokeWidth={1} fill="none" />
        </Svg>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: 28, top: 28 }}>
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d="M12 2l1.8 8.2L22 12l-8.2 1.8L12 22l-1.8-8.2L2 12l8.2-1.8z" fill="#E2E3E7" />
        </Svg>
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  icono: { width: 44, height: 44, borderRadius: 14, backgroundColor: color.acentoSuave, alignItems: 'center', justifyContent: 'center' },
});

