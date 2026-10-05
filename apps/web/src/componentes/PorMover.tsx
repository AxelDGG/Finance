import { prefijoSobrante, useDatos, useResumen } from '@finanzas/api';
import { esGasto, formatoMXN, nombrePeriodo, periodoDe, presupuestoDelMes, sumarMeses } from '@finanzas/core';
import { useMemo, useState } from 'react';
import { errorTexto } from '../lib/movimientos';
import { IcCheck } from './iconos';
import { useAvisos } from './ui';

/** Lista de "por mover": los apartados son cuentas reales, se marcan al hacerlo en el banco. */
export function PorMoverLista() {
  const { config, acciones } = useDatos();
  const { avisar } = useAvisos();
  const r = useResumen();
  const hechos = r.porMoverMes.filter((p) => p.hecho_en).length;

  const alternar = async (id: string, hecho: boolean) => {
    try {
      await acciones.marcarPorMover(id, hecho);
    } catch (e) {
      avisar(errorTexto(e), true);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <span className="eyebrow">Por mover este mes</span>
        {r.porMoverMes.length > 0 && (
          <span className="chip acc">
            {hechos} de {r.porMoverMes.length} hechos
          </span>
        )}
      </div>
      {r.porMoverMes.length === 0 && (
        <p className="tenue" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
          Nada por ahora. Cuando llegue un ingreso te diremos cuánto pasar a cada meta.
        </p>
      )}
      {r.porMoverMes.map((p) => {
        const apartado = config.apartados.find((a) => a.id === p.apartado_id);
        const on = !!p.hecho_en;
        return (
          <button key={p.id} className={`chk-row ${on ? 'on' : ''}`} onClick={() => void alternar(p.id, !on)} aria-pressed={on}>
            <span className="chk">
              <IcCheck tamano={14} stroke="#0A0B0D" />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span className="chk-t" style={{ fontSize: 14, fontWeight: 500 }}>{p.descripcion ?? `Apartar ${formatoMXN(p.monto_centavos)}`}</span>
              <span style={{ fontSize: 12.5, color: 'var(--texto3)' }}>{apartado?.destino ?? apartado?.nombre ?? 'Apartado'}</span>
            </span>
          </button>
        );
      })}
      <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--texto3)' }}>Tus apartados son cuentas reales. Márcalos cuando hagas el movimiento en tu banco.</p>
    </>
  );
}

/** Lo que sobró de Gastos personales el mes pasado: propone mandarlo a una meta. */
export function CierreMes() {
  const { config, movimientos, porMover, acciones } = useDatos();
  const { avisar } = useAvisos();
  const [meta, setMeta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const metas = config.apartados.filter((a) => a.tipo === 'meta' && !a.archivado);

  const cierre = useMemo(() => {
    const anterior = sumarMeses(periodoDe(new Date()), -1);
    const movs = movimientos.filter((m) => periodoDe(m.fecha) === anterior);
    if (movs.length === 0) return null;
    const presupuesto = presupuestoDelMes(config, movs).total;
    const gastado = movs.filter(esGasto).reduce((a, m) => a + m.monto_centavos, 0);
    const yaPropuesto = porMover.some((p) => p.descripcion?.startsWith(prefijoSobrante(anterior)));
    return { periodo: anterior, sobrante: presupuesto - gastado, yaPropuesto };
  }, [movimientos, config, porMover]);

  if (!cierre) return null;

  const enviar = async () => {
    const elegida = metas.find((m) => m.id === meta);
    if (!elegida) return;
    setEnviando(true);
    try {
      await acciones.enviarSobranteAMeta(cierre.periodo, cierre.sobrante, elegida);
      avisar(`Agregamos "${formatoMXN(cierre.sobrante)} para ${elegida.nombre}" a tus movimientos por hacer.`);
    } catch (e) {
      avisar(errorTexto(e), true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="card rise" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="eyebrow">Cierre de {nombrePeriodo(cierre.periodo, true)}</span>
      {cierre.sobrante > 0 ? (
        <>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>
            Te sobraron <b>{formatoMXN(cierre.sobrante)}</b> de Gastos personales. ¿Los mandas a una meta?
          </p>
          {cierre.yaPropuesto ? (
            <span className="chip acc" style={{ alignSelf: 'flex-start' }}>Ya está en tus movimientos por hacer</span>
          ) : metas.length === 0 ? (
            <span className="tenue" style={{ fontSize: 13 }}>Crea una meta para poder mandarle tu sobrante.</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {metas.map((m) => (
                <button key={m.id} className={`cpick ${meta === m.id ? 'on' : ''}`} onClick={() => setMeta(m.id)} aria-pressed={meta === m.id}>
                  {m.nombre}
                </button>
              ))}
              <button className="btn pri sm" disabled={!meta || enviando} onClick={() => void enviar()} style={{ marginLeft: 'auto' }}>
                {enviando ? 'Enviando…' : 'Mandar a la meta'}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="tenue" style={{ margin: 0, fontSize: 14 }}>
          Ese mes gastaste {formatoMXN(-cierre.sobrante)} más de tu presupuesto.
        </p>
      )}
    </section>
  );
}
