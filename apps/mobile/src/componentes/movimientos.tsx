import type { ConfigUsuario, Movimiento } from '@finanzas/core';
import { etiquetaDia, formatoMXN, hora } from '@finanzas/core';
import { useDatos } from '@finanzas/api';
import { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color, fuente } from '../lib/tema';
import { Avatar, Boton, Chip, ChipElegible, Presionable, T, TextoMetal } from './base';
import { HojaInferior } from './HojaInferior';

const NOMBRE_AVISO: Record<string, string> = { wallet: 'Wallet', bbva: 'BBVA', santander: 'Santander' };

export function signo(m: Movimiento) {
  return m.tipo === 'ingreso' ? '+' : m.tipo === 'gasto' ? '−' : '';
}

export function colorMonto(m: Movimiento) {
  return m.tipo === 'ingreso' ? color.ingreso : m.tipo === 'interno' ? color.texto3 : color.texto;
}

export function nombreMovimiento(m: Movimiento, config: ConfigUsuario): string {
  if (m.comercio) return m.comercio;
  if (m.tipo === 'ingreso') return config.fuentes.find((f) => f.id === m.fuente_id)?.nombre ?? 'Ingreso';
  if (m.tipo === 'interno') return config.apartados.find((a) => a.id === m.apartado_id)?.nombre ?? 'Movimiento interno';
  if (m.avisos.includes('wallet')) return 'Pago con Google Wallet';
  return config.categorias.find((c) => c.id === m.categoria_id)?.nombre ?? 'Gasto';
}

export function etiquetaCategoria(m: Movimiento, config: ConfigUsuario): string {
  if (m.tipo === 'ingreso') return 'Ingreso';
  if (m.tipo === 'interno') return 'Interno';
  return config.categorias.find((c) => c.id === m.categoria_id)?.nombre ?? 'Sin categoría';
}

/** "Wallet + BBVA", "Santander", "Manual". */
export function etiquetaOrigen(m: Movimiento, config: ConfigUsuario): string {
  const avisos = m.avisos.map((a) => NOMBRE_AVISO[a] ?? a);
  if (avisos.length > 0) {
    const ordenados = avisos.sort((a, b) => (a === 'Wallet' ? -1 : b === 'Wallet' ? 1 : 0));
    return ordenados.join(' + ');
  }
  const cuenta = config.cuentas.find((c) => c.id === m.cuenta_id);
  return cuenta ? `${cuenta.alias} · manual` : 'Manual';
}

export function FilaMovimiento({ m, onPress, mostrarHora = true }: { m: Movimiento; onPress?: () => void; mostrarHora?: boolean }) {
  const { config } = useDatos();
  const nombre = nombreMovimiento(m, config);
  const fusionado = m.avisos.length > 1;
  return (
    <Presionable onPress={onPress} escala={0.98} vibrar={false} accessibilityRole="button" accessibilityLabel={`${nombre}, ${signo(m)}${formatoMXN(m.monto_centavos)}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16 }}>
        <Avatar texto={nombre} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <T v="medio" numberOfLines={1} style={{ fontSize: 14.5 }}>
            {nombre}
          </T>
          <View style={{ flexDirection: 'row', gap: 6, overflow: 'hidden' }}>
            <Chip texto={etiquetaCategoria(m, config)} />
            <Chip texto={etiquetaOrigen(m, config)} acento={fusionado} />
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontFamily: fuente.semi, fontSize: 14.5, color: colorMonto(m), fontVariant: ['tabular-nums'] }}>
            {signo(m)}
            {formatoMXN(m.monto_centavos)}
          </Text>
          {mostrarHora && <T v="mono" style={{ fontSize: 11, color: color.tenue }}>{hora(m.fecha)}</T>}
        </View>
      </View>
    </Presionable>
  );
}

function IconoCampana() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color.acentoClaro} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  );
}

/** Hoja con el detalle de un movimiento: categoría editable, cómo se detectó y descartar. */
export function DetalleMovimiento({ m: elegido, onCerrar }: { m: Movimiento | null; onCerrar: () => void }) {
  const { config, acciones, movimientos } = useDatos();
  const [guardando, setGuardando] = useState(false);
  // Categoría elegida, mostrada al instante mientras se guarda.
  const [categoriaLocal, setCategoriaLocal] = useState<{ id: string; categoria: string } | null>(null);
  // Conservamos el último movimiento para que la hoja se cierre con su contenido.
  const ultimo = useRef<Movimiento | null>(null);
  if (elegido) ultimo.current = movimientos.find((x) => x.id === elegido.id) ?? elegido;
  const m = ultimo.current;
  const visible = !!elegido;
  if (!m) return null;

  const nombre = nombreMovimiento(m, config);
  const cuenta = config.cuentas.find((c) => c.id === m.cuenta_id);
  const apartado = config.apartados.find((a) => a.id === m.apartado_id);
  const nota =
    m.avisos.length > 1
      ? 'Llegaron 2 notificaciones del mismo pago y se juntaron en un solo movimiento.'
      : m.tipo === 'interno'
        ? 'Movimiento entre tus cuentas: se registra, pero no se descuenta de tus gastos.'
        : m.tipo === 'ingreso'
          ? 'Ingreso: se reparte con tus reglas de reparto.'
          : m.avisos.length === 1 && m.avisos[0] === 'wallet'
            ? 'Se registró desde Google Wallet. Cuando llegue el aviso del banco se juntará aquí.'
            : m.avisos.length === 1
              ? 'Se registró desde la notificación del banco.'
            : 'Lo registraste a mano.';

  const cambiarCategoria = async (id: string) => {
    setCategoriaLocal({ id: m.id, categoria: id });
    setGuardando(true);
    try {
      await acciones.actualizarMovimiento(m.id, { categoria_id: id });
    } catch (e) {
      setCategoriaLocal(null);
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };
  const categoriaActual = categoriaLocal?.id === m.id ? categoriaLocal.categoria : m.categoria_id;

  const descartar = () =>
    Alert.alert('¿Quitar este movimiento?', 'Dejará de contar en tus gastos. Úsalo si fue un error o un duplicado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          await acciones.descartarMovimiento(m.id);
          onCerrar();
        },
      },
    ]);

  return (
    <HojaInferior visible={visible} onCerrar={onCerrar}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar texto={nombre} tamano={52} />
        <View style={{ flex: 1, gap: 5 }}>
          <T v="semi" style={{ fontSize: 17 }}>{nombre}</T>
          <T v="tenue">
            {etiquetaDia(m.fecha)} · {hora(m.fecha)}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 20 }}>
        <TextoMetal tamano={52}>{`${signo(m)}${formatoMXN(m.monto_centavos)}`}</TextoMetal>
        <Chip texto={m.tipo === 'gasto' ? 'Gasto' : m.tipo === 'ingreso' ? 'Ingreso' : 'Interno'} acento />
      </View>

      <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.025)', gap: 12 }}>
        <Fila etiqueta="Cuenta" valor={cuenta ? cuenta.alias : 'Sin identificar'} />
        <Fila etiqueta="Apartado" valor={apartado?.nombre ?? (m.tipo === 'ingreso' ? 'Se reparte con tus reglas' : '—')} />
        {m.descripcion ? <Fila etiqueta="Nota" valor={m.descripcion} /> : null}
      </View>

      {m.tipo === 'gasto' && (
        <View style={{ marginTop: 20, gap: 12 }}>
          <T v="eyebrow">Categoría {guardando ? '· guardando…' : ''}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {config.categorias.map((c) => (
              <ChipElegible key={c.id} texto={c.nombre} activo={c.id === categoriaActual} onPress={() => void cambiarCategoria(c.id)} />
            ))}
          </View>
          <T v="pequeno">Si cambias la categoría, la app la recordará para este comercio.</T>
        </View>
      )}

      <View style={{ marginTop: 20, gap: 8 }}>
        <T v="eyebrow">Cómo se detectó</T>
        {m.avisos.length === 0 ? (
          <T v="tenue">Captura manual.</T>
        ) : (
          m.avisos.map((a) => (
            <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: color.acentoSuave, alignItems: 'center', justifyContent: 'center' }}>
                <IconoCampana />
              </View>
              <T v="cuerpo">Notificación de {NOMBRE_AVISO[a] ?? a}</T>
            </View>
          ))
        )}
        <View style={{ marginTop: 4, padding: 12, borderRadius: 12, backgroundColor: 'rgba(154,141,242,0.08)', borderWidth: 1, borderColor: 'rgba(183,173,255,0.18)' }}>
          <T style={{ color: color.acentoTexto, fontSize: 13, lineHeight: 19 }}>{nota}</T>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
        <Boton titulo="Quitar" variante="secundario" onPress={descartar} style={{ flex: 1 }} />
        <Boton titulo="Listo" onPress={onCerrar} style={{ flex: 2 }} />
      </View>
    </HojaInferior>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <T v="tenue" style={{ color: color.texto3 }}>{etiqueta}</T>
      <T style={{ flexShrink: 1, textAlign: 'right' }}>{valor}</T>
    </View>
  );
}
