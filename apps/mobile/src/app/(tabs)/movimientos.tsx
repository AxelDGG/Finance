import { useDatos, useResumen } from '@finanzas/api';
import type { Movimiento } from '@finanzas/core';
import { claveDia, esGasto, etiquetaDia, formatoMXN, normalizar, periodoDe } from '@finanzas/core';
import { useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Tarjeta } from '../../componentes/base';
import { BotonIcono, Encabezado } from '../../componentes/Encabezado';
import { Segmentado } from '../../componentes/graficas';
import { IconoBuscar } from '../../componentes/iconos';
import { DetalleMovimiento, FilaMovimiento, nombreMovimiento } from '../../componentes/movimientos';
import { useContador } from '../../componentes/useContador';
import { color, fuente, suave } from '../../lib/tema';

// Al filtrar o buscar, las filas solo aparecen (sin cascada ni resorte).
const APARECER = FadeIn.duration(suave.duration).easing(suave.easing);

const FILTROS = ['Todos', 'Gastos', 'Ingresos', 'Internos'] as const;
const TIPOS: Array<Movimiento['tipo'] | null> = [null, 'gasto', 'ingreso', 'interno'];

type Elemento = { tipo: 'dia'; clave: string; etiqueta: string; total: number } | { tipo: 'mov'; m: Movimiento; indice: number };

export default function Movimientos() {
  const insets = useSafeAreaInsets();
  const { movimientos, config, cargando, recargar } = useDatos();
  const r = useResumen();
  const [filtro, setFiltro] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<Movimiento | null>(null);
  const filtrada = useRef(false);

  const semana = useContador(r.series.dias.reduce((a, d) => a + d.monto, 0));
  const fusionadosMes = r.movsMes.filter((m) => m.avisos.length > 1).length;

  const elementos = useMemo<Elemento[]>(() => {
    const tipo = TIPOS[filtro];
    const q = normalizar(busqueda);
    const lista = movimientos.filter((m) => (!tipo || m.tipo === tipo) && (!q || normalizar(nombreMovimiento(m, config)).includes(q)));
    const salida: Elemento[] = [];
    let diaActual = '';
    let indice = 0;
    for (const m of lista) {
      const clave = claveDia(m.fecha);
      if (clave !== diaActual) {
        diaActual = clave;
        const total = lista.filter((x) => esGasto(x) && claveDia(x.fecha) === clave).reduce((a, x) => a + x.monto_centavos, 0);
        salida.push({ tipo: 'dia', clave, etiqueta: etiquetaDia(m.fecha), total });
      }
      salida.push({ tipo: 'mov', m, indice: indice++ });
    }
    return salida;
  }, [movimientos, filtro, busqueda, config]);

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <FlatList
        // Cambiar de filtro vuelve a montar la lista para que las filas entren animadas.
        key={`lista-${filtro}`}
        data={elementos}
        keyExtractor={(e) => (e.tipo === 'dia' ? `d-${e.clave}` : e.m.id)}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => void recargar(['movimientos'])} tintColor={color.acento} colors={[color.acento]} progressBackgroundColor={color.hoja} />}
        initialNumToRender={20}
        windowSize={10}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 6 }}>
            <Encabezado
              eyebrow={nombreMesActual()}
              titulo="MOVIMIENTOS"
              derecha={
                <BotonIcono etiqueta="Buscar" activo={buscando} onPress={() => { setBuscando(!buscando); if (buscando) setBusqueda(''); }}>
                  <IconoBuscar tamano={18} color={color.texto} />
                </BotonIcono>
              }
            />
            {buscando && (
              <Animated.View entering={FadeInUp.duration(suave.duration).easing(suave.easing)}>
                <TextInput
                  autoFocus
                  value={busqueda}
                  onChangeText={(t) => {
                    filtrada.current = true;
                    setBusqueda(t);
                  }}
                  placeholder="Buscar comercio"
                  placeholderTextColor={color.tenue}
                  selectionColor={color.acento}
                  accessibilityLabel="Buscar comercio"
                  style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(183,173,255,0.45)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, color: color.texto, fontFamily: fuente.regular, fontSize: 15 }}
                />
              </Animated.View>
            )}
            <Tarjeta retraso={60} style={{ padding: 18, flexDirection: 'row' }}>
              <View style={{ flex: 1, gap: 8 }}>
                <T v="eyebrow">Gastado · semana</T>
                <T v="display" style={{ fontSize: 30 }}>{formatoMXN(Math.round(semana), { decimales: 'nunca' })}</T>
                <T v="pequeno">Últimos 7 días</T>
              </View>
              <View style={{ flex: 1, gap: 8, paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: color.borde }}>
                <T v="eyebrow">Fusionados</T>
                <T v="display" style={{ fontSize: 30 }}>{fusionadosMes}</T>
                <T v="pequeno">pagos con Wallet sin duplicar este mes</T>
              </View>
            </Tarjeta>
            <Animated.View entering={FadeInDown.delay(120).springify().damping(18)}>
              <Segmentado
                opciones={[...FILTROS]}
                valor={filtro}
                onCambio={(i) => {
                  filtrada.current = true;
                  setFiltro(i);
                }}
              />
            </Animated.View>
          </View>
        }
        ListEmptyComponent={
          <Animated.View entering={FadeIn}>
            <T v="tenue" style={{ textAlign: 'center', padding: 40 }}>
              {busqueda ? 'No hay movimientos con esa búsqueda.' : 'No hay movimientos con ese filtro.'}
            </T>
          </Animated.View>
        }
        renderItem={({ item }) =>
          item.tipo === 'dia' ? (
            <Animated.View entering={filtrada.current ? APARECER : FadeInDown.delay(60).springify().damping(18)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 4, paddingHorizontal: 10 }}>
              <T v="semi" style={{ fontSize: 12.5, color: '#C9CBD1' }}>{item.etiqueta}</T>
              {item.total > 0 && <T v="mono" style={{ color: color.tenue, fontSize: 11.5 }}>−{formatoMXN(item.total)}</T>}
            </Animated.View>
          ) : (
            <Animated.View entering={filtrada.current ? APARECER : FadeInDown.delay(Math.min(item.indice, 10) * 40 + 100).springify().damping(18)}>
              <FilaMovimiento m={item.m} onPress={() => setDetalle(item.m)} />
            </Animated.View>
          )
        }
      />
      <DetalleMovimiento m={detalle} onCerrar={() => setDetalle(null)} />
    </View>
  );
}

function nombreMesActual() {
  const [a, m] = periodoDe(new Date()).split('-');
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${meses[Number(m) - 1]} ${a}`;
}
