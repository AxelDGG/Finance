import { useDatos } from '@finanzas/api';
import type { Movimiento } from '@finanzas/core';
import { etiquetaDia, formatoMXN, hora, leerMonto } from '@finanzas/core';
import { useEffect, useRef, useState } from 'react';
import { colorMonto, errorTexto, etiquetaCategoria, etiquetaOrigen, iniciales, montoConSigno, NOMBRE_AVISO, nombreMovimiento, notaMovimiento } from '../lib/movimientos';
import { IcCampana, IcCerrar } from './iconos';
import { CampoDinero, Campo, Dialogo, Segmentado, useAvisos } from './ui';

export function FilaMovimiento({ m, onAbrir, activo, compacta, retraso }: { m: Movimiento; onAbrir: () => void; activo?: boolean; compacta?: boolean; retraso?: number }) {
  const { config } = useDatos();
  const nombre = nombreMovimiento(m, config);
  return (
    <button className={`row ${activo ? 'on' : ''} ${retraso != null ? 'rise' : ''}`} onClick={onAbrir} aria-pressed={activo} style={retraso != null ? { animationDelay: `${retraso}ms` } : undefined}>
      <span className="av">{iniciales(nombre)}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: compacta ? 5 : 7, minWidth: 0 }}>
        <span className="recortar" style={{ fontSize: compacta ? 14 : 14.5 }}>{nombre}</span>
        {compacta ? (
          <span style={{ fontSize: 12, color: 'var(--texto3)' }} className="recortar">
            {etiquetaDia(m.fecha)} · {etiquetaOrigen(m, config)}
          </span>
        ) : (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--texto3)', marginRight: 4 }}>
              {etiquetaDia(m.fecha)} · {hora(m.fecha)}
            </span>
            <span className="chip">{etiquetaCategoria(m, config)}</span>
            <span className={`chip ${m.avisos.length > 1 ? 'acc' : ''}`}>{etiquetaOrigen(m, config)}</span>
          </span>
        )}
      </span>
      <span style={{ fontSize: compacta ? 14.5 : 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: colorMonto(m) }}>{montoConSigno(m)}</span>
    </button>
  );
}

/** Panel lateral con el detalle: categoría editable, cómo se detectó y quitar. */
export function DetalleMovimiento({ m, onCerrar }: { m: Movimiento; onCerrar: () => void }) {
  const { config, acciones } = useDatos();
  const { avisar, confirmar } = useAvisos();
  const [categoria, setCategoria] = useState(m.categoria_id);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setCategoria(m.categoria_id), [m.id, m.categoria_id]);

  const nombre = nombreMovimiento(m, config);
  const cuenta = config.cuentas.find((c) => c.id === m.cuenta_id);
  const apartado = config.apartados.find((a) => a.id === m.apartado_id);

  const cambiarCategoria = async (id: string) => {
    const antes = categoria;
    setCategoria(id);
    setGuardando(true);
    try {
      await acciones.actualizarMovimiento(m.id, { categoria_id: id });
      avisar(`Categoría guardada. La recordaremos para ${nombre}.`);
    } catch (e) {
      setCategoria(antes);
      avisar(errorTexto(e), true);
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    const ok = await confirmar({ titulo: '¿Quitar este movimiento?', texto: 'Dejará de contar en tus gastos. Úsalo si fue un error o un duplicado.', accion: 'Quitar', peligro: true });
    if (!ok) return;
    try {
      await acciones.descartarMovimiento(m.id);
      avisar('Movimiento quitado.');
      onCerrar();
    } catch (e) {
      avisar(errorTexto(e), true);
    }
  };

  return (
    <aside key={m.id} className="card slidein detalle-mov" aria-label="Detalle del movimiento" style={{ flex: '1 1 320px', minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 22, position: 'sticky', top: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow">Detalle</span>
        <button className="btn sq" onClick={onCerrar} aria-label="Cerrar detalle">
          <IcCerrar tamano={16} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="av" style={{ width: 52, height: 52, borderRadius: 16, fontSize: 18 }}>{iniciales(nombre)}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{nombre}</span>
          <span style={{ fontSize: 13, color: '#9A9DA6' }}>
            {etiquetaDia(m.fecha)} · {hora(m.fecha)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span className="metal display" style={{ fontSize: 52 }}>{montoConSigno(m)}</span>
        <span className="chip acc">{m.tipo === 'gasto' ? 'Gasto' : m.tipo === 'ingreso' ? 'Ingreso' : 'Interno'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '12px 16px', padding: 16, borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 14 }}>
        <span style={{ color: 'var(--texto3)' }}>Cuenta</span>
        <span style={{ textAlign: 'right' }}>{cuenta ? `${cuenta.alias}${m.terminacion ? ` ·· ${m.terminacion}` : ''}` : 'Sin identificar'}</span>
        <span style={{ color: 'var(--texto3)' }}>Apartado</span>
        <span style={{ textAlign: 'right' }}>{apartado?.nombre ?? (m.tipo === 'ingreso' ? 'Se reparte con tus reglas' : '—')}</span>
        {m.descripcion && (
          <>
            <span style={{ color: 'var(--texto3)' }}>Nota</span>
            <span style={{ textAlign: 'right' }}>{m.descripcion}</span>
          </>
        )}
      </div>
      {m.tipo === 'gasto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="eyebrow">Categoría {guardando ? '· guardando…' : ''}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {config.categorias.map((c) => (
              <button key={c.id} className={`cpick ${c.id === categoria ? 'on' : ''}`} onClick={() => void cambiarCategoria(c.id)} aria-pressed={c.id === categoria}>
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="eyebrow">Cómo se detectó</span>
        {m.avisos.length === 0 ? (
          <span className="tenue" style={{ fontSize: 14 }}>{m.origen === 'importado' ? 'Desde tu estado de cuenta.' : 'Captura manual.'}</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {m.avisos.map((a) => (
              <div key={a} style={{ display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr)', gap: 12, alignItems: 'center', padding: '8px 0' }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, background: 'rgba(154,141,242,0.14)', color: 'var(--acento-claro)' }}>
                  <IcCampana tamano={15} />
                </span>
                <span style={{ fontSize: 14 }}>Notificación de {NOMBRE_AVISO[a] ?? a}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ margin: 0, padding: '12px 14px', borderRadius: 12, background: 'rgba(154,141,242,0.08)', border: '1px solid rgba(183,173,255,0.18)', fontSize: 13, lineHeight: 1.5, color: 'var(--acento-texto)' }}>{notaMovimiento(m)}</p>
      </div>
      <button className="btn peligro" onClick={() => void quitar()}>
        Quitar movimiento
      </button>
    </aside>
  );
}

/** Registrar un gasto a mano (efectivo, o algo que no llegó por notificación). */
export function NuevoGasto({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { config, acciones } = useDatos();
  const { avisar } = useAvisos();
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState(0);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const campoMonto = useRef<HTMLDivElement>(null);
  const opcionesCuenta = [...config.cuentas.map((c) => c.alias), 'Efectivo'];
  const gastos = config.apartados.find((a) => a.tipo === 'gastos');

  useEffect(() => {
    if (!abierto) return;
    setMonto('');
    setNota('');
    setCategoria(config.categorias[0]?.id ?? null);
    const principal = config.cuentas.findIndex((c) => c.id === gastos?.cuenta_id || c.es_principal);
    setCuenta(principal >= 0 ? principal : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const guardar = async () => {
    const centavos = leerMonto(monto);
    if (!centavos) {
      // Sacudir sin volver a montar el campo, para no perder el foco.
      campoMonto.current?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(0)' }], { duration: 400 });
      campoMonto.current?.querySelector('input')?.focus();
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
      avisar(`${formatoMXN(centavos)} se descontó de Gastos personales`);
      onCerrar();
    } catch (e) {
      avisar(errorTexto(e), true);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} etiqueta="Registrar gasto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="metal display" style={{ margin: 0, fontSize: 32 }}>REGISTRAR GASTO</h2>
          <button type="button" className="btn sq" onClick={onCerrar} aria-label="Cerrar">
            <IcCerrar tamano={16} />
          </button>
        </div>
        <div ref={campoMonto}>
          <CampoDinero etiqueta="Monto" valor={monto} onCambio={setMonto} placeholder="0.00" grande />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="eyebrow">Categoría</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {config.categorias.map((c) => (
              <button type="button" key={c.id} className={`cpick ${c.id === categoria ? 'on' : ''}`} onClick={() => setCategoria(c.id)} aria-pressed={c.id === categoria}>
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="eyebrow">Cuenta</span>
          <Segmentado etiqueta="Cuenta" opciones={opcionesCuenta} valor={cuenta} onCambio={setCuenta} />
        </div>
        <Campo etiqueta="Descripción" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional · ej. Tacos con amigos" />
        <button type="submit" className="btn pri" disabled={guardando} style={{ minHeight: 52 }}>
          {guardando ? 'Guardando…' : 'Guardar gasto'}
          <span className="kbd">Enter</span>
        </button>
      </form>
    </Dialogo>
  );
}
