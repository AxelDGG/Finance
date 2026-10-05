import { useDatos, useResumen } from '@finanzas/api';
import { claveDia, etiquetaDia, hora } from '@finanzas/core';
import { useEffect, useRef, useState } from 'react';
import { navegar, type Ruta } from '../lib/ruta';
import { pesos } from '../lib/movimientos';
import { IcAjustes, IcApartados, IcCampana, IcChevron, IcContraer, IcMovimientos, IcResumen } from './iconos';

const leerPreferencia = (clave: string, defecto: boolean) => {
  try {
    const v = localStorage.getItem(clave);
    return v == null ? defecto : v === '1';
  } catch {
    return defecto;
  }
};
const guardarPreferencia = (clave: string, valor: boolean) => {
  try {
    localStorage.setItem(clave, valor ? '1' : '0');
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
};

/** Panel flotante de vidrio: disponible, secciones con píldora deslizante, metas y cuentas. */
export function Sidebar({ ruta }: { ruta: Ruta }) {
  const { config, movimientos, porRevisar, dispositivos } = useDatos();
  const r = useResumen();
  const [contraido, setContraido] = useState(() => leerPreferencia('finanzas-menu-contraido', false));
  const [subAbierto, setSubAbierto] = useState(() => leerPreferencia('finanzas-menu-metas', true));
  const nav = useRef<HTMLElement>(null);
  const [pildora, setPildora] = useState<{ y: number; alto: number } | null>(null);

  const secciones = [
    { vista: 'resumen', nombre: 'Resumen', icono: <IcResumen /> },
    { vista: 'movimientos', nombre: 'Movimientos', icono: <IcMovimientos /> },
    { vista: 'apartados', nombre: 'Apartados y metas', icono: <IcApartados /> },
    { vista: 'revisar', nombre: 'Por revisar', icono: <IcCampana /> },
    { vista: 'ajustes', nombre: 'Ajustes', icono: <IcAjustes /> },
  ] as const;
  const hoy = claveDia(new Date());
  const movsHoy = movimientos.filter((m) => claveDia(m.fecha) === hoy).length;
  const cuentaSel = ruta.vista === 'movimientos' ? ruta.params.get('cuenta') : null;

  // La píldora sigue al botón activo (también cuando se abre el submenú).
  useEffect(() => {
    const medir = () => {
      // Relativo al <nav> (el botón de Apartados vive dentro de otro contenedor posicionado).
      // Se suman los offsetTop (no les afectan las animaciones con transform).
      const activo = nav.current?.querySelector<HTMLElement>('.nav-btn.on') ?? null;
      let y = 0;
      for (let el: HTMLElement | null = activo; el && el !== nav.current; el = el.offsetParent as HTMLElement | null) y += el.offsetTop;
      setPildora(activo ? { y, alto: activo.offsetHeight } : null);
    };
    medir();
    const t = setTimeout(medir, 520);
    return () => clearTimeout(t);
  }, [ruta.vista, subAbierto, contraido, config.apartados.length]);

  const alternarMenu = () => {
    setContraido(!contraido);
    guardarPreferencia('finanzas-menu-contraido', !contraido);
  };
  const alternarSub = () => {
    setSubAbierto(!subAbierto);
    guardarPreferencia('finanzas-menu-metas', !subAbierto);
  };

  // Captura activa si algún teléfono mandó algo en las últimas 48 h.
  const activos = dispositivos.filter((d) => !d.revocado);
  const ultimo = activos.map((d) => d.ultimo_uso).filter(Boolean).sort().reverse()[0] ?? null;
  const capturaViva = !!ultimo && Date.now() - Date.parse(ultimo) < 48 * 3600 * 1000;

  return (
    <aside className={`side ${contraido ? 'contraido' : ''}`} aria-label="Menú">
      <div className="panel rise">
        <div className="marca" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, paddingLeft: 8 }}>
          <span className="logo">F</span>
          <span className="lbl" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
            <span className="metal display" style={{ fontSize: 21, letterSpacing: '0.05em' }}>FINANZAS</span>
            <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tenue)' }}>Control personal</span>
          </span>
        </div>

        <div className="coll solo-ancho">
          <div>
            <button className="mini" onClick={() => navegar('apartados')} aria-label={`Disponible para gastar: ${pesos(r.resumen.disponible)}. Ver apartados`}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--texto2)' }}>
                  {r.resumen.disponible >= 0 ? 'Disponible' : 'Excedido'}
                </span>
                <span className="badge dim">{Math.round(r.resumen.pctUsado)}% usado</span>
              </span>
              <span className="metal display" style={{ fontSize: 32 }}>
                {r.resumen.disponible < 0 ? '−' : ''}
                {pesos(Math.abs(r.resumen.disponible))}
              </span>
              <span className="track" style={{ height: 5 }}>
                <span className="fill" style={{ width: `${r.resumen.pctUsado}%`, background: 'linear-gradient(90deg, #6F737D, #E2E3E7)' }} />
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--texto3)' }}>
                de {pesos(r.resumen.presupuesto)} · quedan {r.resumen.diasRestantes} días
              </span>
            </button>
          </div>
        </div>

        <div className="seccion-nav" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="sect">General</span>
          <nav ref={nav} aria-label="Secciones" className="nav">
            {pildora && <span className="pill" style={{ height: pildora.alto, transform: `translateY(${pildora.y}px)` }} />}
            {secciones.map((s) => {
              const on = ruta.vista === s.vista;
              const insignia = s.vista === 'movimientos' && movsHoy > 0 ? `${movsHoy} hoy` : s.vista === 'revisar' && porRevisar.length > 0 ? String(porRevisar.length) : null;
              const boton = (
                <button
                  key={s.vista}
                  className={`nav-btn ${on ? 'on' : ''}`}
                  onClick={() => navegar(s.vista)}
                  aria-current={on ? 'page' : undefined}
                  title={contraido ? s.nombre : undefined}
                >
                  <span className="ico">{s.icono}</span>
                  <span className="lbl" style={{ flex: 1, justifyContent: 'space-between' }}>
                    {s.nombre}
                    {insignia && <span className="badge">{insignia}</span>}
                  </span>
                </button>
              );
              if (s.vista !== 'apartados') return boton;
              return (
                <div key={s.vista}>
                  <div style={{ position: 'relative' }}>
                    {boton}
                    {r.metas.length > 0 && (
                      <button className={`sub-tog ${subAbierto ? 'abierto' : ''}`} onClick={alternarSub} aria-label={subAbierto ? 'Ocultar metas' : 'Mostrar metas'} aria-expanded={subAbierto}>
                        <IcChevron tamano={16} />
                      </button>
                    )}
                  </div>
                  <div className={`coll ${subAbierto && r.metas.length > 0 ? '' : 'oculto'}`}>
                    <div>
                      <div className="sub">
                        {r.gastos && (
                          <button className="sub-btn" onClick={() => navegar('apartados')} tabIndex={subAbierto ? 0 : -1}>
                            <span className="punto" style={{ background: '#E2E3E7' }} />
                            <span className="recortar">{r.gastos.nombre}</span>
                            <span className="val">{pesos(Math.max(0, r.resumen.disponible))}</span>
                          </button>
                        )}
                        {r.metas.map((m) => (
                          <button key={m.apartado.id} className="sub-btn" onClick={() => navegar('apartados', { meta: m.apartado.id })} tabIndex={subAbierto ? 0 : -1}>
                            <span className="punto" style={{ background: m.apartado.color }} />
                            <span className="recortar">{m.apartado.nombre}</span>
                            <span className="val">{m.progreso.meta > 0 ? `${Math.round(m.progreso.progreso * 100)}%` : pesos(m.progreso.ahorrado)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {config.cuentas.length > 0 && (
          <div className="seccion-cuentas" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="sect" style={{ marginBottom: 2 }}>Cuentas</span>
            {config.cuentas.map((c) => {
              const sel = cuentaSel === c.id;
              const cantidad = r.movsMes.filter((m) => m.cuenta_id === c.id).length;
              const esGastos = r.gastos?.cuenta_id === c.id;
              return (
                <button
                  key={c.id}
                  className={`nav-btn cuenta ${sel ? 'sel' : ''}`}
                  onClick={() => navegar('movimientos', { cuenta: sel ? null : c.id })}
                  aria-pressed={sel}
                  title={contraido ? c.alias : undefined}
                  style={{ height: 52 }}
                >
                  <span className="ico mono">{c.banco === 'BBVA' ? 'B' : c.banco === 'Santander' ? 'S' : c.alias.slice(0, 1).toUpperCase()}</span>
                  <span className="lbl" style={{ flex: 1, justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                      <span>{c.alias}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--tenue)' }}>{esGastos ? 'Gastos personales' : c.terminaciones.length ? `•• ${c.terminaciones[0]}` : c.banco}</span>
                    </span>
                    <span className="badge dim">{cantidad}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="pie-panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="coll">
            <div>
              <div className="cap" title={ultimo ? `Último envío: ${etiquetaDia(ultimo)} ${hora(ultimo)}` : undefined}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Captura automática</span>
                  <span className={`pulse ${capturaViva ? '' : 'apagado'}`} />
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--texto3)', whiteSpace: 'nowrap' }}>
                  {activos.length === 0 ? 'Vincula tu teléfono Android' : capturaViva ? 'BBVA · Santander · Google Wallet' : ultimo ? `Último envío ${etiquetaDia(ultimo).toLowerCase()}` : 'Esperando el primer aviso'}
                </span>
              </div>
            </div>
          </div>
          <button className="nav-btn" onClick={alternarMenu} aria-label={contraido ? 'Expandir menú' : 'Contraer menú'} aria-expanded={!contraido}>
            <span className="ico">
              <IcContraer style={{ transition: 'transform .5s cubic-bezier(.34,1.5,.5,1)', transform: `rotate(${contraido ? 180 : 0}deg)` }} />
            </span>
            <span className="lbl">Contraer menú</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
