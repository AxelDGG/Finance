import { useDatos, useResumen } from '@finanzas/api';
import { diasEnMes, nombrePeriodo, partes } from '@finanzas/core';
import { useState } from 'react';
import { Dona, GraficaBarras } from '../componentes/graficas';
import { IcDestello, IcFlecha, IcTelefono } from '../componentes/iconos';
import { FilaMovimiento } from '../componentes/movimientos';
import { PorMoverLista } from '../componentes/PorMover';
import { Barra, Segmentado, useContador, Vacio } from '../componentes/ui';
import { navegar } from '../lib/ruta';
import { pesos } from '../lib/movimientos';

const PERIODOS = ['Semana', 'Mes', '6 meses'];

const comparar = (pct: number | null, contra: string) =>
  pct == null ? `Sin datos de ${contra}` : `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(Math.round(pct))}% vs ${contra}`;

export function Resumen() {
  const { config, movimientos, dispositivos } = useDatos();
  const r = useResumen();
  const [periodo, setPeriodo] = useState(0);
  const serie = periodo === 0 ? r.series.dias : periodo === 1 ? r.series.semanas : r.series.meses;
  const [sel, setSel] = useState<number | null>(null);
  const seleccion = sel != null && sel < serie.length ? sel : serie.length - 1;
  const totalPeriodo = serie.reduce((a, p) => a + p.monto, 0);
  const disponible = useContador(r.resumen.disponible);
  const totalAnimado = useContador(totalPeriodo);

  const esperados = config.fuentes.filter((f) => f.activo).reduce((a, f) => a + f.monto_esperado_centavos, 0);
  const recibidas = r.presupuesto.porFuente.filter((f) => f.recibido).length;
  const totalPorMover = r.porMoverMes.reduce((a, p) => a + p.monto_centavos, 0);
  const hechoPorMover = r.porMoverMes.filter((p) => p.hecho_en).reduce((a, p) => a + p.monto_centavos, 0);
  const diaDelMes = partes(new Date()).dia;
  const promedioDiario = Math.round(r.resumen.gastado / Math.max(1, diaDelMes));
  const diarioPresupuesto = Math.round(r.resumen.presupuesto / diasEnMes(r.periodo));
  const sinTelefono = dispositivos.filter((d) => !d.revocado).length === 0;
  const recientes = movimientos.slice(0, 5);
  const mesNombre = nombrePeriodo(r.periodo, true).split(' ')[0];

  const kpis = [
    {
      etiqueta: 'Ingresos del mes',
      valor: pesos(r.resumen.ingresos),
      barra: esperados > 0 ? (r.resumen.ingresos / esperados) * 100 : 0,
      fondo: 'linear-gradient(90deg, #5E58A0, #C9C1FF)',
      sub: `de ${pesos(esperados)} esperados · ${recibidas} de ${r.presupuesto.porFuente.length} llegaron`,
    },
    {
      etiqueta: 'Apartado este mes',
      valor: pesos(hechoPorMover),
      barra: totalPorMover > 0 ? (hechoPorMover / totalPorMover) * 100 : 0,
      fondo: 'linear-gradient(90deg, #7A6CE0, #CFC8FF)',
      sub: totalPorMover > 0 ? `de ${pesos(totalPorMover)} por mover este mes` : 'Cuando llegue tu ingreso te diremos cuánto apartar',
    },
    {
      etiqueta: 'Promedio por día',
      valor: pesos(promedioDiario),
      barra: diarioPresupuesto > 0 ? (promedioDiario / diarioPresupuesto) * 100 : 0,
      fondo: 'linear-gradient(90deg, #6F737D, #E2E3E7)',
      sub: `Tu presupuesto da ${pesos(diarioPresupuesto)} al día · ${comparar(r.comparacion.mes, 'el mes pasado')}`,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sinTelefono && (
        <section className="card rise" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 14, background: 'rgba(154,141,242,0.14)', color: 'var(--acento-claro)' }}>
            <IcTelefono />
          </span>
          <span style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Vincula tu teléfono Android</span>
            <span className="tenue" style={{ fontSize: 13 }}>Instala Finanzas en tu teléfono y entra con esta misma cuenta: tus pagos con BBVA, Santander y Google Wallet se registrarán solos.</span>
          </span>
          <button className="btn sm" onClick={() => navegar('ajustes')}>
            Cómo hacerlo <IcFlecha className="go" tamano={14} />
          </button>
        </section>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <section className="card lift rise" style={{ flex: '1 1 380px', minWidth: 0, padding: 28, display: 'flex', flexDirection: 'column', gap: 18, overflow: 'hidden', animationDelay: '60ms' }}>
          <svg aria-hidden="true" width="280" height="280" viewBox="0 0 280 280" style={{ position: 'absolute', right: -110, top: -120, pointerEvents: 'none' }}>
            <circle cx="140" cy="140" r="130" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          </svg>
          <IcDestello className="spark" tamano={18} style={{ position: 'absolute', right: 34, top: 40, color: '#E2E3E7' }} />
          <span className="eyebrow">{r.resumen.disponible >= 0 ? 'Disponible para gastar' : 'Te pasaste del presupuesto'}</span>
          <div className="metal display" style={{ fontSize: 'clamp(60px, 7vw, 96px)', lineHeight: 0.9 }}>
            {r.resumen.disponible < 0 ? '−' : ''}
            {pesos(Math.round(Math.abs(disponible)))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Barra valor={r.resumen.pctUsado} alto={10} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'var(--texto2)' }}>
              <span>
                Gastado {pesos(r.resumen.gastado)} de {pesos(r.resumen.presupuesto)}
              </span>
              <span className="mono">{Math.round(r.resumen.pctUsado)}%</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="chip acc">{r.resumen.porDia > 0 ? `≈ ${pesos(r.resumen.porDia)} por día` : 'Sin margen este mes'}</span>
            <span className="chip">Quedan {r.resumen.diasRestantes} días del mes</span>
            {config.cuentas.length > 0 && <span className="chip">{config.cuentas.map((c) => c.alias).join(' · ')}</span>}
          </div>
        </section>

        <div style={{ flex: '2 1 520px', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 20 }}>
          {kpis.map((k, i) => (
            <div key={k.etiqueta} className="card lift rise" style={{ padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20, animationDelay: `${120 + i * 70}ms` }}>
              <span className="eyebrow">{k.etiqueta}</span>
              <span className="display" style={{ fontSize: 42, color: '#F2F3F5' }}>{k.valor}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Barra valor={k.barra} alto={6} fondo={k.fondo} retraso={300 + i * 100} />
                <span style={{ fontSize: 12.5, lineHeight: 1.4, color: '#9A9DA6' }}>{k.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <section className="card rise" style={{ flex: '999 1 520px', minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 8, animationDelay: '320ms' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="eyebrow">Gastos · {periodo === 0 ? 'últimos 7 días' : periodo === 1 ? `${mesNombre} por semana` : 'últimos 6 meses'}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span className="display" style={{ fontSize: 38 }}>{pesos(Math.round(totalAnimado))}</span>
                <span className="chip">
                  {periodo === 0
                    ? comparar(r.comparacion.semana, 'la semana pasada')
                    : periodo === 1
                      ? comparar(r.comparacion.mes, 'el mes pasado')
                      : `Promedio ${pesos(Math.round(totalPeriodo / Math.max(1, serie.length)))} al mes`}
                </span>
              </div>
            </div>
            <Segmentado
              etiqueta="Periodo"
              opciones={PERIODOS}
              valor={periodo}
              onCambio={(i) => {
                setPeriodo(i);
                setSel(null);
              }}
              estilo={{ minWidth: 260 }}
            />
          </div>
          <GraficaBarras key={periodo} puntos={serie} seleccion={seleccion} onSeleccion={setSel} />
        </section>

        <section className="card rise" style={{ flex: '1 1 360px', minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 18, animationDelay: '400ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span className="eyebrow">Por categoría · {mesNombre}</span>
            <span className="chip">{r.categorias.reduce((a, c) => a + c.cantidad, 0)} gastos</span>
          </div>
          <Dona categorias={r.categorias} total={r.resumen.gastado} />
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: 20 }}>
        <section className="card lift rise" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, animationDelay: '480ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span className="eyebrow">Metas</span>
            <button className="btn sm" onClick={() => navegar('apartados')}>
              Ver apartados <IcFlecha className="go" tamano={14} />
            </button>
          </div>
          {r.metas.length === 0 && <Vacio titulo="Aún no tienes metas" texto="Crea una meta (por ejemplo, un viaje o un fondo de emergencia) y decide qué parte de cada ingreso le toca." />}
          {r.metas.map((m, i) => (
            <button key={m.apartado.id} onClick={() => navegar('apartados', { meta: m.apartado.id })} style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  {m.apartado.nombre} <span style={{ fontWeight: 400, color: 'var(--texto3)', fontSize: 13 }}>· {m.apartado.destino ?? 'apartado'}</span>
                </span>
                <span className="display" style={{ fontSize: 24 }}>{m.progreso.meta > 0 ? `${Math.round(m.progreso.progreso * 100)}%` : '—'}</span>
              </span>
              <Barra valor={m.progreso.progreso * 100} alto={10} fondo={m.apartado.color} retraso={500 + i * 120} />
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, color: '#9A9DA6' }}>
                <span>
                  {pesos(m.progreso.ahorrado)} {m.progreso.meta > 0 ? `de ${pesos(m.progreso.meta)}` : 'ahorrado'}
                </span>
                <span style={{ color: 'var(--acento-claro)' }}>{m.progreso.lograda ? '¡Lograda!' : m.progreso.periodoEstimado ? `Llegas en ${m.progreso.textoEstimado}` : m.progreso.textoEstimado}</span>
              </span>
            </button>
          ))}
        </section>

        <section className="card rise" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '540ms' }}>
          <PorMoverLista />
        </section>

        <section className="card rise" style={{ padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 6, animationDelay: '600ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '0 10px 8px' }}>
            <span className="eyebrow">Últimos movimientos</span>
            <button className="btn sm" onClick={() => navegar('movimientos')}>
              Ver todos <IcFlecha className="go" tamano={14} />
            </button>
          </div>
          {recientes.length === 0 && <Vacio titulo="Sin movimientos todavía" texto="Cuando pagues con tu tarjeta aparecerán aquí solos." />}
          {recientes.map((m) => (
            <FilaMovimiento key={m.id} m={m} compacta onAbrir={() => navegar('movimientos', { sel: m.id })} />
          ))}
        </section>
      </div>
    </div>
  );
}
