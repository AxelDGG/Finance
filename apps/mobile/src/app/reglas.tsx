import { useDatos } from '@finanzas/api';
import type { Apartado, Cuenta, FuenteIngreso } from '@finanzas/core';
import { formatoMXN, leerMonto, porcentajeDe } from '@finanzas/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boton, T, Tarjeta } from '../componentes/base';
import { BotonIcono, Encabezado } from '../componentes/Encabezado';
import { Campo, CampoDinero, Pasos } from '../componentes/formulario';
import { Segmentado } from '../componentes/graficas';
import { IconoAtras } from '../componentes/iconos';
import { color, paleta } from '../lib/tema';

const aTexto = (c: number | null | undefined) => (c ? (c / 100).toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '');

export default function Reglas() {
  const insets = useSafeAreaInsets();
  const { config } = useDatos();
  const metas = config.apartados.filter((a) => a.tipo === 'meta' && !a.archivado);
  const gastos = config.apartados.find((a) => a.tipo === 'gastos');

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Encabezado
          eyebrow="Cuentas, ingresos y metas"
          titulo="REGLAS"
          derecha={
            <BotonIcono etiqueta="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
              <IconoAtras tamano={18} color={color.texto} />
            </BotonIcono>
          }
        />

        <T v="eyebrow" style={{ marginTop: 6 }}>Ingresos y reparto</T>
        {config.fuentes.map((f, i) => (
          <EditorFuente key={f.id} fuente={f} metas={metas} retraso={i * 60} />
        ))}
        <EditorFuente metas={metas} retraso={120} />

        <T v="eyebrow" style={{ marginTop: 10 }}>Metas</T>
        {metas.map((m, i) => (
          <EditorMeta key={m.id} meta={m} retraso={i * 60} orden={i} />
        ))}
        <EditorMeta retraso={120} orden={metas.length} />

        <T v="eyebrow" style={{ marginTop: 10 }}>Cuentas</T>
        {config.cuentas.map((c, i) => (
          <EditorCuenta key={c.id} cuenta={c} esGastos={gastos?.cuenta_id === c.id} gastos={gastos ?? null} retraso={i * 60} />
        ))}
      </ScrollView>
    </View>
  );
}

function EditorFuente({ fuente, metas, retraso }: { fuente?: FuenteIngreso; metas: Apartado[]; retraso: number }) {
  const { config, acciones } = useDatos();
  const [abierto, setAbierto] = useState(!!fuente);
  const [nombre, setNombre] = useState(fuente?.nombre ?? '');
  const [monto, setMonto] = useState(aTexto(fuente?.monto_esperado_centavos));
  const [cuenta, setCuenta] = useState(Math.max(0, config.cuentas.findIndex((c) => c.id === fuente?.cuenta_id)));
  const [quincenal, setQuincenal] = useState(fuente?.frecuencia === 'quincenal');
  const [reglas, setReglas] = useState<Record<string, number>>(() =>
    Object.fromEntries(metas.map((m) => [m.id, fuente ? porcentajeDe(fuente.id, m.id, config.reglas, config.apartados) : 0])),
  );
  const [guardando, setGuardando] = useState(false);
  const total = Object.values(reglas).reduce((a, b) => a + b, 0);
  const centavos = leerMonto(monto) ?? 0;

  if (!abierto) return <Boton titulo="Agregar ingreso" variante="secundario" onPress={() => setAbierto(true)} />;

  const guardar = async () => {
    if (!nombre.trim() || !centavos) {
      Alert.alert('Faltan datos', 'Escribe el nombre y el monto del ingreso.');
      return;
    }
    setGuardando(true);
    try {
      const guardada = await acciones.guardarFuente({ id: fuente?.id, nombre: nombre.trim(), monto_esperado_centavos: centavos, frecuencia: quincenal ? 'quincenal' : 'mensual', cuenta_id: config.cuentas[cuenta]?.id ?? null });
      await acciones.guardarReglas(guardada.id, Object.entries(reglas).map(([apartado_id, porcentaje]) => ({ apartado_id, porcentaje })));
      if (!fuente) {
        setNombre('');
        setMonto('');
        setAbierto(false);
      }
      Alert.alert('Guardado', 'Las nuevas reglas aplican a los próximos ingresos.');
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = () =>
    fuente &&
    Alert.alert('¿Quitar este ingreso?', 'Los movimientos que ya tienes se conservan.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => void acciones.borrarFuente(fuente.id) },
    ]);

  return (
    <Tarjeta retraso={retraso} style={{ padding: 18, gap: 14 }}>
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej. Ingreso principal" />
      <CampoDinero etiqueta="Monto al mes" valor={monto} onCambio={setMonto} />
      <T v="eyebrow">¿Cada cuándo te pagan?</T>
      <Segmentado opciones={['Al mes', 'Cada quincena']} valor={quincenal ? 1 : 0} onCambio={(i) => setQuincenal(i === 1)} />
      {quincenal && centavos > 0 ? <T v="pequeno">Dos depósitos de {formatoMXN(Math.round(centavos / 2))}.</T> : null}
      {config.cuentas.length > 0 && (
        <>
          <T v="eyebrow">Llega a</T>
          <Segmentado opciones={config.cuentas.map((c) => c.alias)} valor={cuenta} onCambio={setCuenta} />
        </>
      )}
      {metas.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T>{m.nombre}</T>
            <T v="pequeno">{formatoMXN(Math.round((centavos * (reglas[m.id] ?? 0)) / 100))} al mes</T>
          </View>
          <Pasos valor={reglas[m.id] ?? 0} maximo={100 - (total - (reglas[m.id] ?? 0))} onCambio={(v) => setReglas({ ...reglas, [m.id]: v })} />
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.12)' }}>
        <T>Gastos personales</T>
        <T v="semi">
          {100 - total}% · {formatoMXN(Math.round((centavos * (100 - total)) / 100))}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {fuente && <Boton titulo="Quitar" variante="secundario" onPress={borrar} style={{ flex: 1 }} />}
        <Boton titulo={fuente ? 'Guardar' : 'Agregar'} onPress={() => void guardar()} cargando={guardando} style={{ flex: 2 }} />
      </View>
    </Tarjeta>
  );
}

function EditorMeta({ meta, retraso, orden }: { meta?: Apartado; retraso: number; orden: number }) {
  const { acciones } = useDatos();
  const [abierto, setAbierto] = useState(!!meta);
  const [nombre, setNombre] = useState(meta?.nombre ?? '');
  const [objetivo, setObjetivo] = useState(aTexto(meta?.meta_centavos));
  const [inicial, setInicial] = useState(aTexto(meta?.saldo_inicial_centavos));
  const [destino, setDestino] = useState(meta?.destino ?? '');
  const [guardando, setGuardando] = useState(false);

  if (!abierto) return <Boton titulo="Agregar meta" variante="secundario" onPress={() => setAbierto(true)} />;

  const guardar = async () => {
    if (!nombre.trim()) {
      Alert.alert('Falta el nombre', 'Ponle nombre a tu meta.');
      return;
    }
    setGuardando(true);
    try {
      await acciones.guardarApartado({
        id: meta?.id,
        nombre: nombre.trim(),
        tipo: 'meta',
        meta_centavos: leerMonto(objetivo),
        saldo_inicial_centavos: leerMonto(inicial) ?? 0,
        destino: destino.trim() || null,
        color: meta?.color ?? paleta[orden % 2 === 0 ? 0 : 4] ?? color.acento,
        orden: meta?.orden ?? orden + 1,
      });
      if (!meta) {
        setNombre('');
        setObjetivo('');
        setInicial('');
        setDestino('');
        setAbierto(false);
      }
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  const archivar = () =>
    meta &&
    Alert.alert('¿Archivar esta meta?', 'Deja de recibir dinero de tus reglas. Su historial se conserva.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Archivar', style: 'destructive', onPress: () => void acciones.archivarApartado(meta.id) },
    ]);

  return (
    <Tarjeta retraso={retraso} style={{ padding: 18, gap: 14 }}>
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej. Viaje" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <CampoDinero etiqueta="Meta" valor={objetivo} onCambio={setObjetivo} />
        </View>
        <View style={{ flex: 1 }}>
          <CampoDinero etiqueta="Ya llevabas" valor={inicial} onCambio={setInicial} />
        </View>
      </View>
      <Campo etiqueta="¿Dónde está el dinero?" value={destino} onChangeText={setDestino} placeholder="Ej. Apartado en BBVA" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {meta && <Boton titulo="Archivar" variante="secundario" onPress={archivar} style={{ flex: 1 }} />}
        <Boton titulo={meta ? 'Guardar' : 'Agregar'} onPress={() => void guardar()} cargando={guardando} style={{ flex: 2 }} />
      </View>
    </Tarjeta>
  );
}

function EditorCuenta({ cuenta, esGastos, gastos, retraso }: { cuenta: Cuenta; esGastos: boolean; gastos: Apartado | null; retraso: number }) {
  const { acciones } = useDatos();
  const [alias, setAlias] = useState(cuenta.alias);
  const [terminaciones, setTerminaciones] = useState(cuenta.terminaciones.join(', '));
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await acciones.guardarCuenta({
        ...cuenta,
        alias: alias.trim() || cuenta.alias,
        terminaciones: terminaciones.split(/[,\s]+/).map((t) => t.replace(/\D/g, '')).filter((t) => t.length === 4),
      });
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta retraso={retraso} style={{ padding: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="semi">{cuenta.banco}</T>
        {esGastos ? <T v="pequeno" style={{ color: color.acentoTexto }}>Aquí vive Gastos personales</T> : null}
      </View>
      <Campo etiqueta="Nombre" value={alias} onChangeText={setAlias} />
      <Campo etiqueta="Terminaciones" value={terminaciones} onChangeText={setTerminaciones} keyboardType="number-pad" ayuda="Últimos 4 dígitos de tarjetas y cuentas, separados por coma." />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {!esGastos && gastos && (
          <Boton titulo="Usar para gastos" variante="secundario" onPress={() => void acciones.guardarApartado({ ...gastos, cuenta_id: cuenta.id })} style={{ flex: 1 }} />
        )}
        <Boton titulo="Guardar" onPress={() => void guardar()} cargando={guardando} style={{ flex: 1 }} />
      </View>
    </Tarjeta>
  );
}
