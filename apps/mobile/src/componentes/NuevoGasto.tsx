import { useDatos } from '@finanzas/api';
import { formatoMXN, leerMonto } from '@finanzas/core';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Boton, ChipElegible, T, TextoMetal } from './base';
import { Campo, CampoDinero } from './formulario';
import { Segmentado } from './graficas';
import { HojaInferior } from './HojaInferior';

/** Hoja para registrar un gasto a mano (efectivo, o si algo no llegó por notificación). */
export function NuevoGasto({ visible, onCerrar, onGuardado }: { visible: boolean; onCerrar: () => void; onGuardado: (texto: string) => void }) {
  const { config, acciones } = useDatos();
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState(0);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const sacudida = useSharedValue(0);
  const estiloSacudida = useAnimatedStyle(() => ({ transform: [{ translateX: sacudida.value }] }));

  const opcionesCuenta = [...config.cuentas.map((c) => c.alias), 'Efectivo'];
  const gastos = config.apartados.find((a) => a.tipo === 'gastos');

  useEffect(() => {
    if (visible) {
      setMonto('');
      setNota('');
      setCategoria(config.categorias[0]?.id ?? null);
      const principal = config.cuentas.findIndex((c) => c.es_principal);
      setCuenta(principal >= 0 ? principal : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const guardar = async () => {
    const centavos = leerMonto(monto);
    if (!centavos) {
      sacudida.value = withSequence(withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }), withTiming(-6, { duration: 60 }), withTiming(0, { duration: 60 }));
      return;
    }
    setGuardando(true);
    try {
      const nombreCategoria = config.categorias.find((c) => c.id === categoria)?.nombre ?? 'Gasto';
      await acciones.crearMovimiento({
        tipo: 'gasto',
        monto_centavos: centavos,
        comercio: nota.trim() || nombreCategoria,
        descripcion: nota.trim() || null,
        categoria_id: categoria,
        cuenta_id: config.cuentas[cuenta]?.id ?? null,
        apartado_id: gastos?.id ?? null,
      });
      onGuardado(`${formatoMXN(centavos)} se descontó de Gastos personales`);
      onCerrar();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <HojaInferior visible={visible} onCerrar={onCerrar}>
      <TextoMetal tamano={30}>REGISTRAR GASTO</TextoMetal>
      <Animated.View style={[{ marginTop: 18 }, estiloSacudida]}>
        <CampoDinero etiqueta="Monto" valor={monto} onCambio={setMonto} placeholder="0.00" grande />
      </Animated.View>

      <T v="eyebrow" style={{ marginTop: 20, marginBottom: 10 }}>
        Categoría
      </T>
      <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }} style={{ marginHorizontal: -20, paddingLeft: 20 }}>
        {config.categorias.map((c) => (
          <ChipElegible key={c.id} texto={c.nombre} activo={c.id === categoria} onPress={() => setCategoria(c.id)} />
        ))}
      </ScrollView>

      <T v="eyebrow" style={{ marginTop: 20, marginBottom: 10 }}>
        Cuenta
      </T>
      <Segmentado opciones={opcionesCuenta} valor={cuenta} onCambio={setCuenta} />

      <Campo etiqueta="Descripción" value={nota} onChangeText={setNota} placeholder="Opcional · ej. Tacos con amigos" style={{ marginTop: 20 }} />

      <View style={{ marginTop: 24 }}>
        <Boton titulo="Guardar gasto" onPress={() => void guardar()} cargando={guardando} style={{ minHeight: 56 }} />
      </View>
    </HojaInferior>
  );
}
