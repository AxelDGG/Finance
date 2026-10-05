import { lecturaDeNotificacion, useDatos } from '@finanzas/api';
import type { NotificacionCruda, TipoMovimiento } from '@finanzas/core';
import { APPS, etiquetaDia, formatoMXN, hora, leerMonto, resolverApp } from '@finanzas/core';
import { useState } from 'react';
import { IcCerrar } from '../componentes/iconos';
import { Campo, CampoDinero, Dialogo, Segmentado, useAvisos, Vacio } from '../componentes/ui';
import { errorTexto } from '../lib/movimientos';

const TIPOS: TipoMovimiento[] = ['gasto', 'ingreso', 'interno'];

/** Avisos del banco que la app no supo interpretar sola. */
export function Revisar() {
  const { porRevisar, config, acciones } = useDatos();
  const { avisar } = useAvisos();
  const [abierta, setAbierta] = useState<NotificacionCruda | null>(null);
  const [tipo, setTipo] = useState(0);
  const [monto, setMonto] = useState('');
  const [comercio, setComercio] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [reprocesando, setReprocesando] = useState(false);

  const abrir = (n: NotificacionCruda) => {
    const lectura = lecturaDeNotificacion(n);
    setAbierta(n);
    setTipo(lectura?.tipo === 'transferencia_recibida' ? 1 : 0);
    setMonto(lectura?.monto_centavos ? (lectura.monto_centavos / 100).toFixed(2) : '');
    setComercio(lectura?.comercio ?? '');
    setCategoria(null);
    const banco = APPS[resolverApp(n.app, n.titulo).app]?.banco;
    const idx = config.cuentas.findIndex((c) => c.banco === banco);
    setCuenta(idx >= 0 ? idx : 0);
  };

  const guardar = async () => {
    if (!abierta) return;
    const centavos = leerMonto(monto);
    if (!centavos) return avisar('Escribe el monto del movimiento.', true);
    setGuardando(true);
    try {
      const t = TIPOS[tipo]!;
      await acciones.resolverNotificacion(abierta, {
        tipo: t,
        monto_centavos: centavos,
        comercio: comercio.trim() || null,
        categoria_id: t === 'gasto' ? categoria : null,
        cuenta_id: config.cuentas[cuenta]?.id ?? null,
        apartado_id: t === 'gasto' ? (config.apartados.find((a) => a.tipo === 'gastos')?.id ?? null) : null,
      });
      avisar('Registrado.');
      setAbierta(null);
    } catch (e) {
      avisar(errorTexto(e), true);
    } finally {
      setGuardando(false);
    }
  };

  const ignorar = async (n: NotificacionCruda) => {
    try {
      await acciones.resolverNotificacion(n, { ignorar: true });
    } catch (e) {
      avisar(errorTexto(e), true);
    }
  };

  const reprocesar = async () => {
    setReprocesando(true);
    try {
      const r = await acciones.reprocesar();
      const procesadas = r.resumen.procesada ?? 0;
      avisar(procesadas > 0 ? `Se entendieron ${procesadas} notificaciones más.` : 'Ninguna nueva se pudo interpretar todavía.');
    } catch (e) {
      avisar(errorTexto(e), true);
    } finally {
      setReprocesando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <p className="tenue" style={{ margin: 0, maxWidth: 620, fontSize: 14, lineHeight: 1.55 }}>
          Avisos de tus bancos que la app no supo interpretar sola. Dile qué fueron, o ignóralos si no eran un movimiento.
        </p>
        {porRevisar.length > 0 && (
          <button className="btn sm" disabled={reprocesando} onClick={() => void reprocesar()}>
            {reprocesando ? 'Revisando…' : 'Volver a intentar con todas'}
          </button>
        )}
      </div>

      {porRevisar.length === 0 ? (
        <div className="card rise">
          <Vacio titulo="Todo en orden" texto="No hay notificaciones pendientes de revisar." />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: 16 }}>
          {porRevisar.map((n, i) => {
            const lectura = lecturaDeNotificacion(n);
            const app = APPS[resolverApp(n.app, n.titulo).app]?.nombre ?? n.app;
            return (
              <div key={n.id} className="card lift rise" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, animationDelay: `${i * 50}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{app}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--texto3)' }}>
                    {etiquetaDia(n.publicada_en)} · {hora(n.publicada_en)}
                  </span>
                </div>
                {n.titulo && <span style={{ fontSize: 13.5 }}>{n.titulo}</span>}
                <span className="tenue" style={{ fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word' }}>{n.texto_grande ?? n.texto}</span>
                {lectura?.monto_centavos ? <span className="chip acc" style={{ alignSelf: 'flex-start' }}>Monto leído: {formatoMXN(lectura.monto_centavos)}</span> : null}
                <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 6 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={() => void ignorar(n)}>
                    Ignorar
                  </button>
                  <button className="btn pri" style={{ flex: 2 }} onClick={() => abrir(n)}>
                    Registrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialogo abierto={!!abierta} onCerrar={() => setAbierta(null)} etiqueta="¿Qué fue?">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="metal display" style={{ margin: 0, fontSize: 32 }}>¿QUÉ FUE?</h2>
            <button type="button" className="btn sq" onClick={() => setAbierta(null)} aria-label="Cerrar">
              <IcCerrar tamano={16} />
            </button>
          </div>
          <Segmentado etiqueta="Tipo" opciones={['Gasto', 'Ingreso', 'Entre cuentas']} valor={tipo} onCambio={setTipo} />
          <CampoDinero etiqueta="Monto" valor={monto} onCambio={setMonto} grande />
          <Campo etiqueta={tipo === 0 ? 'Comercio' : 'De / para'} value={comercio} onChange={(e) => setComercio(e.target.value)} placeholder="Opcional" />
          {tipo === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="eyebrow">Categoría</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {config.categorias.map((c) => (
                  <button type="button" key={c.id} className={`cpick ${categoria === c.id ? 'on' : ''}`} onClick={() => setCategoria(c.id)} aria-pressed={categoria === c.id}>
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
          {config.cuentas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="eyebrow">Cuenta</span>
              <Segmentado etiqueta="Cuenta" opciones={config.cuentas.map((c) => c.alias)} valor={cuenta} onCambio={setCuenta} />
            </div>
          )}
          <button type="submit" className="btn pri" disabled={guardando} style={{ minHeight: 52 }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </Dialogo>
    </div>
  );
}
