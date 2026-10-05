import type { CambioCategoria, Comercio, GastoPorCategoriaMeses, Recomendacion } from '@finanzas/core';
import { escalaEje, formatoCorto, formatoMXN } from '@finanzas/core';
import { useState } from 'react';
import { iniciales, pesos } from '../lib/movimientos';
import { navegar } from '../lib/ruta';
import { IcAlerta, IcCheck, IcDestello, IcFlecha } from './iconos';
import { Segmentado, Vacio } from './ui';

const ESTILO_NIVEL: Record<Recomendacion['nivel'], { fondo: string; color: string; borde: string }> = {
  alerta: { fondo: 'rgba(242,167,167,0.12)', color: 'var(--peligro)', borde: 'rgba(242,167,167,0.28)' },
  aviso: { fondo: 'rgba(154,141,242,0.14)', color: 'var(--acento-claro)', borde: 'rgba(183,173,255,0.24)' },
  idea: { fondo: 'rgba(255,255,255,0.05)', color: 'var(--plata)', borde: 'rgba(255,255,255,0.1)' },
  bien: { fondo: 'rgba(154,141,242,0.14)', color: 'var(--acento-claro)', borde: 'rgba(183,173,255,0.24)' },
};

function IconoNivel({ nivel }: { nivel: Recomendacion['nivel'] }) {
  const e = ESTILO_NIVEL[nivel];
  return (
    <span style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 11, background: e.fondo, color: e.color }}>
      {nivel === 'alerta' || nivel === 'aviso' ? <IcAlerta tamano={17} /> : nivel === 'bien' ? <IcCheck tamano={16} /> : <IcDestello tamano={15} />}
    </span>
  );
}

/** Recomendaciones del mes: qué está pasando con tu dinero y qué conviene hacer. */
export function Recomendaciones({ lista }: { lista: Recomendacion[] }) {
  return (
    <section className="card rise" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, animationDelay: '260ms' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className="eyebrow">Recomendaciones</span>
        <span className="chip">{lista.length === 0 ? 'Todo en orden' : `${lista.length} para este mes`}</span>
      </div>
      {lista.length === 0 && <span className="tenue" style={{ fontSize: 13.5 }}>Nada que señalar por ahora. Vas bien.</span>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
        {lista.map((r, i) => {
          const e = ESTILO_NIVEL[r.nivel];
          const accion = r.categoria_id ? () => navegar('movimientos', { cat: r.categoria_id }) : r.id === 'por-mover' || r.id.startsWith('meta-') ? () => navegar('apartados') : null;
          return (
            <div
              key={r.id}
              className={`reco rise ${accion ? 'accionable' : ''}`}
              role={accion ? 'button' : undefined}
              tabIndex={accion ? 0 : undefined}
              onClick={accion ?? undefined}
              onKeyDown={accion ? (ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), accion()) : undefined}
              style={{ borderColor: e.borde, animationDelay: `${320 + i * 80}ms` }}
            >
              <IconoNivel nivel={r.nivel} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: r.nivel === 'alerta' ? 'var(--peligro)' : 'var(--texto)' }}>{r.titulo}</span>
                <span className="tenue" style={{ fontSize: 13, lineHeight: 1.5 }}>{r.texto}</span>
              </span>
              {accion && <IcFlecha className="go" tamano={15} style={{ flex: 'none', color: 'var(--texto3)', alignSelf: 'center' }} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Barras apiladas: cuánto gastaste cada mes y en qué. Pasa el cursor por un mes o una categoría. */
export function BarrasApiladas({ datos }: { datos: GastoPorCategoriaMeses }) {
  const [mes, setMes] = useState<number | null>(null);
  const [serie, setSerie] = useState<string | null>(null);
  const { tope } = escalaEje(Math.max(...datos.meses.map((m) => m.total), 1));
  const lineas = [4, 3, 2, 1, 0].map((k) => (tope * k) / 4);
  const activo = mes ?? datos.meses.length - 1;
  const m = datos.meses[activo];

  if (datos.series.length === 0) return <Vacio titulo="Sin gastos todavía" texto="Cuando registres gastos verás aquí en qué se te va el dinero mes a mes." />;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
      <div style={{ flex: '999 1 420px', minWidth: 0, display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr)', gridTemplateRows: '220px auto', columnGap: 10, rowGap: 12 }}>
        <div className="mono" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', margin: '-6px 0', fontSize: 11, color: '#7E818A' }}>
          {lineas.map((v) => (
            <span key={v}>{v === 0 ? '$0' : formatoCorto(v)}</span>
          ))}
        </div>
        <div style={{ position: 'relative' }} onMouseLeave={() => setMes(null)}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
            {lineas.map((v) => (
              <span key={v} style={{ display: 'block', borderTop: '1px dashed rgba(255,255,255,0.07)' }} />
            ))}
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 'clamp(10px, 2.4vw, 28px)' }}>
            {datos.meses.map((x, i) => (
              <button
                key={x.periodo}
                type="button"
                className={`apil ${i === activo ? 'on' : ''}`}
                onMouseEnter={() => setMes(i)}
                onFocus={() => setMes(i)}
                onClick={() => setMes(i)}
                aria-label={`${x.etiqueta}: ${formatoMXN(x.total)}`}
                style={{ height: `${Math.max(1.5, (x.total / tope) * 100)}%`, animationDelay: `${100 + i * 70}ms` }}
              >
                {datos.series.map((s) => {
                  const monto = x.montos[s.clave] ?? 0;
                  if (monto === 0) return null;
                  return <span key={s.clave} className={`apil-seg ${serie && serie !== s.clave ? 'dim' : ''}`} style={{ flexGrow: monto, background: s.color }} />;
                })}
              </button>
            ))}
          </div>
        </div>
        <span />
        <div style={{ display: 'flex', gap: 'clamp(10px, 2.4vw, 28px)' }}>
          {datos.meses.map((x, i) => (
            <span key={x.periodo} className={`xl ${i === activo ? 'on' : ''}`} style={{ flex: '1 1 0', textAlign: 'center', fontSize: 12, fontWeight: 500 }}>
              {x.corta}
            </span>
          ))}
        </div>
      </div>
      {m && (
        <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }} onMouseLeave={() => setSerie(null)}>
          <span key={`t-${activo}`} className="viewin" style={{ fontSize: 12.5, color: 'var(--texto2)', padding: '0 10px 2px' }}>
            {m.etiqueta}
          </span>
          <span key={`m-${activo}`} className="display viewin" style={{ fontSize: 30, padding: '0 10px 8px' }}>{pesos(m.total)}</span>
          {datos.series.map((s) => {
            const monto = m.montos[s.clave] ?? 0;
            return (
              <button key={s.clave} type="button" className={`leg ${serie === s.clave ? 'on' : serie ? 'dim' : ''}`} onMouseEnter={() => setSerie(s.clave)} onFocus={() => setSerie(s.clave)} onBlur={() => setSerie(null)} onClick={() => s.clave !== 'otras' && s.clave !== 'sin' && navegar('movimientos', { cat: s.clave })}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                <span className="recortar">{s.nombre}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--texto)' }}>{pesos(monto)}</span>
                <span className="mono" style={{ textAlign: 'right', fontSize: 11, color: 'var(--texto3)' }}>{m.total > 0 ? `${Math.round((monto / m.total) * 100)}%` : '—'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Este mes contra el mes pasado al mismo día, por categoría. */
export function ComparacionCategorias({ cambios }: { cambios: CambioCategoria[] }) {
  const lista = cambios.filter((c) => c.actual > 0 || c.anterior > 0).slice(0, 7);
  const maximo = Math.max(...lista.map((c) => Math.max(c.actual, c.anterior)), 1);
  if (lista.length === 0) return <Vacio titulo="Sin datos para comparar" texto="Necesito gastos de este mes o del pasado." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--texto3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--acento)' }} /> Este mes
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.18)' }} /> Mes pasado a estas alturas
        </span>
      </div>
      {lista.map((c, i) => {
        const sube = c.cambioPct != null && c.cambioPct > 0;
        return (
          <button key={c.categoria_id ?? 'sin'} type="button" className="comp rise" style={{ animationDelay: `${i * 60}ms` }} onClick={() => c.categoria_id && navegar('movimientos', { cat: c.categoria_id })}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{c.nombre}</span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pesos(c.actual)}</span>
                <span className="mono" style={{ fontSize: 11.5, minWidth: 54, textAlign: 'right', color: c.cambioPct == null ? 'var(--texto3)' : sube ? 'var(--peligro)' : 'var(--acento-claro)' }}>
                  {c.cambioPct == null ? 'nuevo' : `${sube ? '▲' : '▼'} ${Math.abs(Math.round(c.cambioPct))}%`}
                </span>
              </span>
            </span>
            <span className="track" style={{ height: 8 }}>
              <span className="fill" style={{ width: `${(c.actual / maximo) * 100}%`, background: 'linear-gradient(90deg, #7A6CE0, #CFC8FF)', animationDelay: `${150 + i * 60}ms` }} />
            </span>
            <span className="track" style={{ height: 4 }}>
              <span className="fill" style={{ width: `${(c.anterior / maximo) * 100}%`, background: 'rgba(255,255,255,0.22)', animationDelay: `${200 + i * 60}ms` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Dónde gastas más este mes. */
export function TopComercios({ comercios }: { comercios: Comercio[] }) {
  const maximo = Math.max(...comercios.map((c) => c.total), 1);
  if (comercios.length === 0) return <Vacio titulo="Sin comercios este mes" texto="Aquí verás dónde gastas más." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {comercios.map((c, i) => (
        <button key={c.clave} type="button" className="row rise" style={{ animationDelay: `${i * 60}ms` }} onClick={() => navegar('movimientos', { q: c.nombre })}>
          <span className="av">{iniciales(c.nombre)}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span className="recortar" style={{ fontSize: 14 }}>{c.nombre}</span>
              <span style={{ fontSize: 12, color: 'var(--texto3)', whiteSpace: 'nowrap' }}>
                {c.veces} {c.veces === 1 ? 'vez' : 'veces'}
              </span>
            </span>
            <span className="track" style={{ height: 6 }}>
              <span className="fill" style={{ width: `${(c.total / maximo) * 100}%`, background: 'linear-gradient(90deg, #6F737D, #E2E3E7)', animationDelay: `${150 + i * 60}ms` }} />
            </span>
          </span>
          <span style={{ fontSize: 14.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pesos(c.total)}</span>
        </button>
      ))}
    </div>
  );
}

const VISTAS = ['Por mes', 'Contra el mes pasado', 'Comercios'];

/** "¿En qué se te va el dinero?": tres vistas con transición. */
export function EnQueSeVa({ porCategoriaMeses, cambios, comercios }: { porCategoriaMeses: GastoPorCategoriaMeses; cambios: CambioCategoria[]; comercios: Comercio[] }) {
  const [vista, setVista] = useState(0);
  return (
    <section className="card rise" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, animationDelay: '440ms' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="eyebrow">¿En qué se te va el dinero?</span>
          <span className="tenue" style={{ fontSize: 13 }}>
            {vista === 0 ? 'Últimos 6 meses por categoría. Toca una categoría para ver sus movimientos.' : vista === 1 ? 'Este mes contra el mes pasado hasta el mismo día.' : 'Dónde gastas más este mes.'}
          </span>
        </div>
        <Segmentado etiqueta="Vista" opciones={VISTAS} valor={vista} onCambio={setVista} estilo={{ minWidth: 'min(100%, 380px)' }} />
      </div>
      <div key={vista} className="viewin">
        {vista === 0 && <BarrasApiladas datos={porCategoriaMeses} />}
        {vista === 1 && <ComparacionCategorias cambios={cambios} />}
        {vista === 2 && <TopComercios comercios={comercios} />}
      </div>
    </section>
  );
}
