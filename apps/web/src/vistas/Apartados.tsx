import { useDatos, useResumen } from '@finanzas/api';
import type { ConfigUsuario, ReglaReparto } from '@finanzas/core';
import { porcentajeDe, progresoMeta, proyeccionMeta } from '@finanzas/core';
import { useEffect, useMemo, useState } from 'react';
import { Deslizador } from '../componentes/Deslizador';
import { GraficaProyeccion } from '../componentes/graficas';
import { IcFlecha } from '../componentes/iconos';
import { CierreMes, PorMoverLista } from '../componentes/PorMover';
import { Anillo, Barra, useAvisos, Vacio } from '../componentes/ui';
import { errorTexto, pesos } from '../lib/movimientos';
import { navegar, type Ruta } from '../lib/ruta';
import { PLATA } from '../lib/tema';

type Borrador = Record<string, Record<string, number>>;

export function Apartados({ ruta }: { ruta: Ruta }) {
  const { config, movimientos, aportacionesViejas, acciones } = useDatos();
  const { avisar } = useAvisos();
  const r = useResumen();
  const metas = config.apartados.filter((a) => a.tipo === 'meta' && !a.archivado);
  const metaParam = ruta.params.get('meta');

  // Reglas en borrador: mover un control actualiza al instante las fechas estimadas.
  const original = useMemo<Borrador>(
    () => Object.fromEntries(config.fuentes.map((f) => [f.id, Object.fromEntries(metas.map((m) => [m.id, porcentajeDe(f.id, m.id, config.reglas, config.apartados)]))])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config],
  );
  const [borrador, setBorrador] = useState<Borrador>(original);
  useEffect(() => setBorrador(original), [original]);
  const cambiadas = config.fuentes.filter((f) => metas.some((m) => (borrador[f.id]?.[m.id] ?? 0) !== (original[f.id]?.[m.id] ?? 0)));
  const [guardando, setGuardando] = useState(false);

  const configBorrador = useMemo<ConfigUsuario>(() => {
    const reglas: ReglaReparto[] = Object.entries(borrador).flatMap(([fuente_id, porMeta]) =>
      Object.entries(porMeta)
        .filter(([, p]) => p > 0)
        .map(([apartado_id, porcentaje]) => ({ fuente_id, apartado_id, porcentaje })),
    );
    return { ...config, reglas };
  }, [config, borrador]);

  const todos = useMemo(() => [...movimientos, ...aportacionesViejas], [movimientos, aportacionesViejas]);
  const conProgreso = useMemo(
    () => metas.map((a) => ({ apartado: a, progreso: progresoMeta(a, todos, configBorrador), proyeccion: proyeccionMeta(a, todos, configBorrador) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.apartados, todos, configBorrador],
  );

  const [metaSel, setMetaSel] = useState<string | null>(metaParam);
  useEffect(() => {
    if (metaParam) {
      setMetaSel(metaParam);
      document.getElementById(`meta-${metaParam}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [metaParam]);
  const elegida = conProgreso.find((m) => m.apartado.id === metaSel) ?? conProgreso[0];
  const reales = elegida ? elegida.proyeccion.filter((p) => p.real).length : 0;
  const [punto, setPunto] = useState<number | null>(null);
  useEffect(() => setPunto(null), [elegida?.apartado.id]);
  const sel = elegida ? (punto != null && punto < elegida.proyeccion.length ? punto : Math.max(0, reales - 1)) : 0;
  const puntoSel = elegida?.proyeccion[sel];

  const guardar = async () => {
    setGuardando(true);
    try {
      for (const f of cambiadas) {
        await acciones.guardarReglas(f.id, Object.entries(borrador[f.id] ?? {}).map(([apartado_id, porcentaje]) => ({ apartado_id, porcentaje })));
      }
      avisar('Reglas guardadas. Aplican a tus próximos ingresos.');
    } catch (e) {
      avisar(errorTexto(e), true);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      <CierreMes />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="eyebrow">Reglas de reparto</span>
            <p className="tenue" style={{ margin: 0, maxWidth: 620, fontSize: 14, lineHeight: 1.55 }}>
              Cuando llega un ingreso, se reparte así. Lo que no apartes se queda en Gastos personales. Mueve los controles y mira cómo cambian tus metas.
            </p>
          </div>
          {cambiadas.length > 0 && (
            <div className="rise" style={{ display: 'flex', gap: 8 }}>
              <button className="btn sm" onClick={() => setBorrador(original)}>
                Deshacer
              </button>
              <button className="btn pri sm" disabled={guardando} onClick={() => void guardar()}>
                {guardando ? 'Guardando…' : 'Guardar reglas'}
              </button>
            </div>
          )}
        </div>
        {config.fuentes.length === 0 && (
          <div className="card">
            <Vacio titulo="Sin ingresos" texto="Agrega tus ingresos en Ajustes para repartirlos.">
              <button className="btn sm" onClick={() => navegar('ajustes')}>Ir a ajustes</button>
            </Vacio>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 20 }}>
          {config.fuentes.map((f, i) => {
            const reglas = borrador[f.id] ?? {};
            const total = metas.reduce((a, m) => a + (reglas[m.id] ?? 0), 0);
            const segmentos = [
              ...metas.map((m) => ({ id: m.id, w: reglas[m.id] ?? 0, color: m.color, tc: '#0A0B0D' })),
              { id: 'gastos', w: 100 - total, color: PLATA, tc: '#0A0B0D' },
            ].filter((s) => s.w > 0);
            const cuenta = config.cuentas.find((c) => c.id === f.cuenta_id);
            return (
              <div key={f.id} className="card lift rise" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, animationDelay: `${80 + i * 80}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{f.nombre}</span>
                    <span style={{ fontSize: 13, color: '#9A9DA6' }}>Llega a {cuenta?.alias ?? '—'} · {f.frecuencia === 'quincenal' ? `cada quincena (${pesos(Math.round(f.monto_esperado_centavos / 2))})` : 'cada mes'}</span>
                  </div>
                  <span className="display" style={{ fontSize: 30 }}>{pesos(f.monto_esperado_centavos)}</span>
                </div>
                <div style={{ display: 'flex', height: 34, borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                  {segmentos.map((s) => (
                    <span key={s.id} className="split-seg" style={{ width: `${s.w}%`, background: s.color, color: s.tc }}>
                      {s.w >= 12 ? `${s.w}%` : ''}
                    </span>
                  ))}
                </div>
                {metas.map((m) => {
                  const pct = reglas[m.id] ?? 0;
                  return (
                    <Deslizador
                      key={m.id}
                      id={`rr-${f.id}-${m.id}`}
                      etiqueta={m.nombre}
                      color={m.color}
                      valor={pct}
                      maximo={100 - (total - pct)}
                      detalle={pesos(Math.round((f.monto_esperado_centavos * pct) / 100))}
                      onCambio={(v) => setBorrador({ ...borrador, [f.id]: { ...reglas, [m.id]: v } })}
                    />
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: PLATA }} />
                    Gastos personales <span style={{ color: 'var(--texto3)' }}>(lo que sobra)</span>
                  </span>
                  <span style={{ fontSize: 13, color: '#9A9DA6' }}>
                    <b style={{ color: '#fff', fontWeight: 600 }}>{100 - total}%</b> · {pesos(Math.round((f.monto_esperado_centavos * (100 - total)) / 100))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span className="eyebrow">Tus apartados</span>
          <button className="btn sm" onClick={() => navegar('ajustes', { seccion: 'metas' })}>
            Editar metas <IcFlecha className="go" tamano={14} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20 }}>
          {r.gastos && (
            <div className="card lift rise" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, animationDelay: '320ms' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{r.gastos.nombre}</span>
                <span className="chip">{config.cuentas.find((c) => c.id === r.gastos?.cuenta_id)?.alias ?? 'Cuenta principal'} · principal</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#9A9DA6' }}>{r.resumen.disponible >= 0 ? 'Disponible para gastar' : 'Te pasaste del presupuesto'}</span>
                <span className="metal display" style={{ fontSize: 56 }}>
                  {r.resumen.disponible < 0 ? '−' : ''}
                  {pesos(Math.abs(r.resumen.disponible))}
                </span>
              </div>
              <Barra valor={r.resumen.pctUsado} alto={10} />
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#9A9DA6' }}>
                Presupuesto del mes: <b style={{ color: 'var(--texto)', fontWeight: 600 }}>{pesos(r.resumen.presupuesto)}</b>
                <br />
                {r.presupuesto.porFuente.map((f) => `${pesos(f.monto)} de ${f.nombre.toLowerCase()}${f.recibido ? '' : ' (esperado)'}`).join(' + ')}
                {r.presupuesto.extras > 0 ? ` + ${pesos(r.presupuesto.extras)} extra` : ''}
              </div>
            </div>
          )}
          {conProgreso.map((m, i) => {
            const activa = elegida?.apartado.id === m.apartado.id;
            const p = m.progreso;
            return (
              <div
                key={m.apartado.id}
                id={`meta-${m.apartado.id}`}
                className="card lift rise"
                role="button"
                tabIndex={0}
                onClick={() => setMetaSel(m.apartado.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setMetaSel(m.apartado.id))}
                aria-pressed={activa}
                style={{ cursor: 'pointer', padding: 24, display: 'flex', flexDirection: 'column', gap: 18, animationDelay: `${380 + i * 70}ms`, borderColor: activa ? 'rgba(183,173,255,0.4)' : undefined }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{m.apartado.nombre}</span>
                  <span className="chip">{m.apartado.destino ?? 'Apartado'}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <Anillo valor={p.progreso} color={m.apartado.color}>
                    <span className="display" style={{ fontSize: 30 }}>{p.meta > 0 ? `${Math.round(p.progreso * 100)}%` : '—'}</span>
                    <span style={{ fontSize: 11, color: 'var(--texto3)' }}>{p.meta > 0 ? 'de la meta' : 'sin meta'}</span>
                  </Anillo>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: '#9A9DA6' }}>Llevas</span>
                    <span style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {pesos(p.ahorrado)} {p.meta > 0 && <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--tenue)' }}>/ {pesos(p.meta)}</span>}
                    </span>
                    <span style={{ fontSize: 13, color: '#C9CBD1' }}>Aporte: {pesos(p.aporte)} al mes</span>
                  </span>
                </span>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(154,141,242,0.08)', border: '1px solid rgba(183,173,255,0.18)' }}>
                  <span key={p.textoEstimado} className="viewin" style={{ fontSize: 13.5, color: 'var(--acento-texto)' }}>
                    {p.lograda ? '¡Meta lograda!' : p.periodoEstimado ? `Llegas en ${p.textoEstimado}` : p.textoEstimado}
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--acento-claro)' }}>
                    {p.meses != null && p.meses > 0 ? `${p.meses} ${p.meses === 1 ? 'mes' : 'meses'}` : p.falta > 0 ? `faltan ${pesos(p.falta)}` : ''}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        {metas.length === 0 && (
          <div className="card">
            <Vacio titulo="Aún no tienes metas" texto="Crea una meta (por ejemplo, un viaje o un fondo de emergencia) y decide qué parte de cada ingreso le toca.">
              <button className="btn pri sm" onClick={() => navegar('ajustes', { seccion: 'metas' })}>Crear meta</button>
            </Vacio>
          </div>
        )}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        {elegida && elegida.proyeccion.length > 1 && puntoSel && (
          <section className="card rise" style={{ flex: '999 1 520px', minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, animationDelay: '460ms' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="eyebrow">Proyección · {elegida.apartado.nombre}</span>
                <span key={`${elegida.apartado.id}-${sel}`} className="display viewin" style={{ fontSize: 34 }}>{pesos(puntoSel.acumulado)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span className="tenue" style={{ fontSize: 13 }}>{puntoSel.etiqueta}</span>
                <span className={`chip ${puntoSel.real ? '' : 'acc'}`}>{puntoSel.real ? 'Real' : 'Proyectado'}</span>
              </div>
            </div>
            <GraficaProyeccion puntos={elegida.proyeccion} meta={elegida.progreso.meta} color={elegida.apartado.color} seleccion={sel} onSeleccion={setPunto} />
            <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--texto3)' }}>
              <span>{elegida.proyeccion[0]?.etiqueta}</span>
              <span style={{ color: 'var(--acento-claro)' }}>hoy · {elegida.proyeccion[Math.max(0, reales - 1)]?.etiqueta}</span>
              <span>{elegida.proyeccion[elegida.proyeccion.length - 1]?.etiqueta}</span>
            </div>
          </section>
        )}
        <section className="card rise" style={{ flex: '1 1 340px', minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '520ms' }}>
          <PorMoverLista />
        </section>
      </div>
    </div>
  );
}
