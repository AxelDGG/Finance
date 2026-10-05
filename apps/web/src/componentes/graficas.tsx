import type { GastoCategoria, PuntoProyeccion, PuntoSerie } from '@finanzas/core';
import { escalaEje, formatoCorto, formatoMXN } from '@finanzas/core';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { pesos } from '../lib/movimientos';

/** Barras con eje, tooltip que sigue al cursor y selección al hacer clic. */
export function GraficaBarras({ puntos, seleccion, onSeleccion, alto = 240 }: { puntos: PuntoSerie[]; seleccion: number; onSeleccion: (i: number) => void; alto?: number }) {
  const [encima, setEncima] = useState<number | null>(null);
  const { tope } = escalaEje(Math.max(...puntos.map((p) => p.monto), 1));
  const lineas = [4, 3, 2, 1, 0].map((k) => (tope * k) / 4);
  const activo = encima ?? seleccion;
  const p = puntos[activo];
  const n = Math.max(1, puntos.length);
  const altoActivo = p ? Math.max(2, (p.monto / tope) * 100) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr)', gridTemplateRows: `${alto}px auto`, columnGap: 10, rowGap: 12, marginTop: 64 }}>
      <div className="mono" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', margin: '-6px 0', fontSize: 11, color: '#7E818A' }}>
        {lineas.map((v) => (
          <span key={v}>{v === 0 ? '$0' : formatoCorto(v)}</span>
        ))}
      </div>
      <div style={{ position: 'relative' }} onMouseLeave={() => setEncima(null)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
          {lineas.map((v) => (
            <span key={v} style={{ display: 'block', borderTop: '1px dashed rgba(255,255,255,0.07)' }} />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 'clamp(8px, 2vw, 24px)' }}>
          {puntos.map((b, i) => (
            <button
              key={b.clave}
              type="button"
              className={`barcol ${i === activo ? 'on' : activo != null ? 'dim' : ''}`}
              onClick={() => onSeleccion(i)}
              onMouseEnter={() => setEncima(i)}
              onFocus={() => setEncima(i)}
              onBlur={() => setEncima(null)}
              aria-label={`${b.etiqueta}: ${formatoMXN(b.monto)}, ${b.cantidad} movimientos`}
              aria-pressed={i === seleccion}
            >
              <span className="bar" style={{ height: `${Math.max(1.5, (b.monto / tope) * 100)}%`, animationDelay: `${120 + i * 70}ms` }} />
            </button>
          ))}
        </div>
        {p && (
          <div className="tip" style={{ left: `${((activo + 0.5) / n) * 100}%`, bottom: `${altoActivo}%` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '10px 12px', borderRadius: 12, background: 'rgba(20,21,26,0.94)', border: '1px solid rgba(183,173,255,0.3)', boxShadow: '0 14px 30px -10px rgba(0,0,0,0.9)' }}>
              <span style={{ fontSize: 11.5, color: 'var(--texto2)' }}>{p.etiqueta}</span>
              <span className="display" style={{ fontSize: 21, color: '#fff' }}>{formatoMXN(p.monto)}</span>
              <span style={{ fontSize: 11.5, color: 'var(--acento-claro)' }}>
                {p.cantidad} {p.cantidad === 1 ? 'movimiento' : 'movimientos'}
              </span>
            </div>
          </div>
        )}
      </div>
      <span />
      <div style={{ display: 'flex', gap: 'clamp(8px, 2vw, 24px)' }}>
        {puntos.map((b, i) => (
          <span key={b.clave} className={`xl ${i === activo ? 'on' : ''}`} style={{ flex: '1 1 0', textAlign: 'center', fontSize: 12, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {b.corta}
          </span>
        ))}
      </div>
    </div>
  );
}

const CIRC = 2 * Math.PI * 80;

/** Dona por categoría con leyenda: pasar el cursor o hacer clic resalta. */
export function Dona({ categorias, total }: { categorias: GastoCategoria[]; total: number }) {
  const [fijo, setFijo] = useState<number | null>(null);
  const [encima, setEncima] = useState<number | null>(null);
  const activo = encima ?? fijo;
  const sel = activo != null ? categorias[activo] : null;
  let acumulado = 0;
  const segmentos = categorias.map((c) => {
    const largo = (c.pct / 100) * CIRC;
    const s = { largo: Math.max(0, largo - (categorias.length > 1 ? 3 : 0)), inicio: acumulado };
    acumulado += largo;
    return s;
  });
  const alternar = (i: number) => setFijo(fijo === i ? null : i);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <div style={{ position: 'relative', flex: 'none', width: 200, height: 200 }} onMouseLeave={() => setEncima(null)}>
        {categorias.length === 0 && (
          <svg className="dn" width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="18" />
          </svg>
        )}
        {categorias.map((c, i) => (
          <svg key={c.categoria_id ?? 'sin'} className="dn" width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
            <circle
              className={`dseg ${activo === i ? 'on' : activo != null ? 'dim' : ''}`}
              cx="100"
              cy="100"
              r="80"
              style={{ stroke: c.color, strokeDasharray: `${segmentos[i]!.largo} ${CIRC}`, strokeDashoffset: -segmentos[i]!.inicio, animationDelay: `${300 + i * 90}ms` }}
              onMouseEnter={() => setEncima(i)}
              onClick={() => alternar(i)}
            />
          </svg>
        ))}
        <div style={{ position: 'absolute', inset: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', pointerEvents: 'none' }}>
          <span key={`n-${activo}`} className="viewin" style={{ fontSize: 12, color: 'var(--texto2)', maxWidth: 110 }}>{sel ? sel.nombre : 'Total del mes'}</span>
          <span key={`m-${activo}`} className="display viewin" style={{ fontSize: 28 }}>{pesos(sel ? sel.monto : total)}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--acento-claro)' }}>{sel ? `${Math.round(sel.pct)}% · ${sel.cantidad} movs.` : `${categorias.length} categorías`}</span>
        </div>
      </div>
      <div style={{ flex: '1 1 210px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }} onMouseLeave={() => setEncima(null)}>
        {categorias.length === 0 && <span className="tenue" style={{ fontSize: 13, padding: 10 }}>Sin gastos este mes.</span>}
        {categorias.map((c, i) => (
          <button
            key={c.categoria_id ?? 'sin'}
            type="button"
            className={`leg ${activo === i ? 'on' : activo != null ? 'dim' : ''}`}
            onClick={() => alternar(i)}
            onMouseEnter={() => setEncima(i)}
            onFocus={() => setEncima(i)}
            onBlur={() => setEncima(null)}
            aria-pressed={fijo === i}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
            <span className="recortar">{c.nombre}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--texto)' }}>{pesos(c.monto)}</span>
            <span className="mono" style={{ textAlign: 'right', fontSize: 11, color: 'var(--texto3)' }}>{Math.round(c.pct)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAncho(el.clientWidth);
    const obs = new ResizeObserver(() => setAncho(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, ancho] as const;
}

/** Línea del ahorro de una meta: lo real sólido, lo proyectado punteado. */
export function GraficaProyeccion({ puntos, meta, color, seleccion, onSeleccion }: { puntos: PuntoProyeccion[]; meta: number; color: string; seleccion: number; onSeleccion: (i: number) => void }) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const alto = 190;
  const margen = { izq: 8, der: 8, arriba: 16, abajo: 10 };
  const tope = Math.max(meta, ...puntos.map((p) => p.acumulado), 1);
  const n = puntos.length;
  const x = (i: number) => margen.izq + (n <= 1 ? 0 : (i / (n - 1)) * (ancho - margen.izq - margen.der));
  const y = (v: number) => margen.arriba + (1 - v / tope) * (alto - margen.arriba - margen.abajo);
  const reales = puntos.filter((p) => p.real).length;
  const camino = (desde: number, hasta: number) =>
    puntos
      .slice(desde, hasta)
      .map((p, k) => `${k === 0 ? 'M' : 'L'}${x(desde + k).toFixed(1)},${y(p.acumulado).toFixed(1)}`)
      .join(' ');
  const lineaReal = camino(0, reales);
  const lineaProy = camino(Math.max(0, reales - 1), n);
  const area = n > 1 ? `${camino(0, n)} L${x(n - 1).toFixed(1)},${alto - margen.abajo} L${x(0).toFixed(1)},${alto - margen.abajo} Z` : '';
  const sel = puntos[seleccion];
  const idGrad = `grad-${color.replace('#', '')}`;

  // Flechas del teclado para recorrer los puntos.
  const contenedor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onSeleccion(Math.min(n - 1, seleccion + 1));
      if (e.key === 'ArrowLeft') onSeleccion(Math.max(0, seleccion - 1));
    };
    el.addEventListener('keydown', tecla);
    return () => el.removeEventListener('keydown', tecla);
  }, [n, seleccion, onSeleccion]);

  return (
    <div ref={contenedor} tabIndex={0} role="slider" aria-label="Mes de la proyección" aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={seleccion} aria-valuetext={sel ? `${sel.etiqueta}: ${formatoMXN(sel.acumulado)}` : ''} style={{ outlineOffset: 6, borderRadius: 8 }}>
      <div ref={ref} style={{ position: 'relative', height: alto }}>
        {ancho > 0 && (
          <svg width={ancho} height={alto} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
            <defs>
              <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {meta > 0 && (
              <>
                <line x1={0} x2={ancho} y1={y(meta)} y2={y(meta)} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 6" />
                <text x={ancho - 4} y={y(meta) - 8} textAnchor="end" fill="#8E919A" fontSize="11" fontFamily="Geist Mono, monospace">
                  meta {formatoCorto(meta)}
                </text>
              </>
            )}
            <path d={area} fill={`url(#${idGrad})`} className="aparecer" />
            {reales > 1 && <path d={lineaReal} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="trazo" />}
            {n > reales && <path d={lineaProy} fill="none" stroke={color} strokeOpacity="0.7" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" className="aparecer" />}
            {sel && (
              <g style={{ transition: 'transform 0.5s cubic-bezier(0.34, 1.3, 0.5, 1)', transform: `translate(${x(seleccion)}px, ${y(sel.acumulado)}px)` }}>
                <line x1={0} x2={0} y1={0} y2={alto - margen.abajo - y(sel.acumulado)} stroke="rgba(255,255,255,0.18)" />
                <circle r="11" fill={color} opacity="0.18" />
                <circle r="5.5" fill="#0E0F12" stroke={color} strokeWidth="2.5" />
              </g>
            )}
            {puntos.map((p, i) => (
              <rect
                key={p.periodo}
                x={x(i) - (ancho / Math.max(1, n)) / 2}
                y={0}
                width={ancho / Math.max(1, n)}
                height={alto}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => onSeleccion(i)}
                onClick={() => onSeleccion(i)}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
