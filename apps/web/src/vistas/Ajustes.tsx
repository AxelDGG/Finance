import { useDatos } from '@finanzas/api';
import type { Apartado, Cuenta, FuenteIngreso } from '@finanzas/core';
import { etiquetaDia, exportarCSV, formatoMXN, hora, leerMonto, porcentajeDe } from '@finanzas/core';
import { useEffect, useState, type ReactNode } from 'react';
import { Deslizador } from '../componentes/Deslizador';
import { IcDescargar, IcSalir, IcSubir, IcTelefono } from '../componentes/iconos';
import { Importar } from '../componentes/Importar';
import { CierreMes } from '../componentes/PorMover';
import { Campo, CampoDinero, Segmentado, useAvisos } from '../componentes/ui';
import { errorTexto } from '../lib/movimientos';
import type { Ruta } from '../lib/ruta';
import { supabase } from '../lib/supabase';
import { descargar } from '../lib/tauri';
import { PALETA } from '../lib/tema';

const aTexto = (c: number | null | undefined) => (c ? (c / 100).toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '');
const digitos = (t: string) =>
  t
    .split(/[,\s]+/)
    .map((x) => x.replace(/\D/g, ''))
    .filter((x) => x.length === 4);

function Seccion({ id, titulo, texto, children, retraso = 0 }: { id: string; titulo: string; texto?: string; children: ReactNode; retraso?: number }) {
  return (
    <section id={`sec-${id}`} className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 14, animationDelay: `${retraso}ms`, scrollMarginTop: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="eyebrow">{titulo}</span>
        {texto && <p className="tenue" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, maxWidth: 640 }}>{texto}</p>}
      </div>
      {children}
    </section>
  );
}

const rejilla = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16 } as const;

export function Ajustes({ ruta }: { ruta: Ruta }) {
  const { sesion, config, movimientos, dispositivos, acciones } = useDatos();
  const { avisar, confirmar } = useAvisos();
  const [importando, setImportando] = useState(false);
  const metas = config.apartados.filter((a) => a.tipo === 'meta' && !a.archivado);
  const gastos = config.apartados.find((a) => a.tipo === 'gastos') ?? null;
  const seccion = ruta.params.get('seccion');

  useEffect(() => {
    if (seccion) setTimeout(() => document.getElementById(`sec-${seccion}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }, [seccion]);

  const cerrarSesion = async () => {
    const ok = await confirmar({ titulo: '¿Cerrar sesión?', texto: 'Tendrás que volver a entrar con tu correo en esta computadora.', accion: 'Cerrar sesión' });
    if (ok) await supabase.auth.signOut();
  };

  const quitarTelefono = async (id: string) => {
    const ok = await confirmar({ titulo: '¿Desvincular este teléfono?', texto: 'Ya no podrá mandar notificaciones a tu cuenta.', accion: 'Desvincular', peligro: true });
    if (!ok) return;
    try {
      await acciones.revocarDispositivo(id);
      avisar('Teléfono desvinculado.');
    } catch (e) {
      avisar(errorTexto(e), true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
      <CierreMes />

      <Seccion id="captura" titulo="Captura automática" texto="Tu teléfono Android lee los avisos de BBVA, Santander y Google Wallet y los manda aquí. Solo eso: no lee mensajes ni otras apps.">
        <div style={rejilla}>
          <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontWeight: 600 }}>Teléfonos vinculados</span>
            {dispositivos.length === 0 && <span className="tenue" style={{ fontSize: 13.5 }}>Ninguno todavía.</span>}
            {dispositivos.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,0.04)', color: d.revocado ? 'var(--tenue)' : 'var(--acento-claro)' }}>
                  <IcTelefono tamano={16} />
                </span>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ color: d.revocado ? 'var(--tenue)' : undefined }} className="recortar">{d.nombre}</span>
                  <span style={{ fontSize: 12, color: 'var(--texto3)' }}>{d.revocado ? 'Desvinculado' : d.ultimo_uso ? `Último envío: ${etiquetaDia(d.ultimo_uso)} ${hora(d.ultimo_uso)}` : 'Sin envíos todavía'}</span>
                </span>
                {!d.revocado && (
                  <button className="btn sm peligro" onClick={() => void quitarTelefono(d.id)}>
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 600 }}>Vincular tu teléfono</span>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, lineHeight: 1.5, color: 'var(--texto2)' }}>
              <li>Instala la app Finanzas en tu Android y entra con <b style={{ color: 'var(--texto)' }}>{sesion?.user.email}</b>.</li>
              <li>Activa el acceso a notificaciones cuando te lo pida.</li>
              <li>En Samsung, agrega Finanzas a "Apps que nunca se suspenden" (Batería).</li>
              <li>
                Android 15 oculta el texto de los avisos bancarios. Con el teléfono conectado por USB corre una vez:
                <code className="mono" style={{ display: 'block', marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 11.5, wordBreak: 'break-all', color: 'var(--texto)' }}>
                  adb shell appops set mx.finanzas.app RECEIVE_SENSITIVE_NOTIFICATIONS allow
                </code>
              </li>
            </ol>
          </div>
        </div>
      </Seccion>

      <Seccion id="ingresos" titulo="Ingresos y reparto" texto="Cuánto te llega cada mes, a qué cuenta, y qué parte va a cada meta. El resto se queda en Gastos personales." retraso={60}>
        <div style={rejilla}>
          {config.fuentes.map((f) => (
            <EditorFuente key={f.id} fuente={f} metas={metas} />
          ))}
          <EditorFuente metas={metas} />
        </div>
      </Seccion>

      <Seccion id="metas" titulo="Metas" texto="Apartados reales (otra cuenta o un apartado del banco) con su meta y lo que ya llevabas." retraso={120}>
        <div style={rejilla}>
          {metas.map((m, i) => (
            <EditorMeta key={m.id} meta={m} orden={i} />
          ))}
          <EditorMeta orden={metas.length} />
        </div>
      </Seccion>

      <Seccion id="cuentas" titulo="Cuentas" texto="Las terminaciones (últimos 4 dígitos) sirven para saber de qué cuenta salió cada pago." retraso={180}>
        <div style={rejilla}>
          {config.cuentas.map((c) => (
            <EditorCuenta key={c.id} cuenta={c} esGastos={gastos?.cuenta_id === c.id} gastos={gastos} />
          ))}
        </div>
      </Seccion>

      <Seccion id="categorias" titulo="Categorías" texto="Cuando corriges la categoría de un movimiento, la app la recuerda para ese comercio." retraso={220}>
        <EditorCategorias />
      </Seccion>

      <Seccion id="datos" titulo="Tus datos" retraso={260}>
        <div style={rejilla}>
          <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontWeight: 600 }}>Exportar</span>
            <span className="tenue" style={{ fontSize: 13.5, lineHeight: 1.5 }}>Todos tus movimientos de los últimos 18 meses en CSV, para Excel o Google Sheets.</span>
            <button
              className="btn"
              onClick={() => {
                descargar('finanzas-movimientos.csv', exportarCSV(movimientos, config.categorias, config.cuentas));
                avisar(`Exportamos ${movimientos.length} movimientos.`);
              }}
            >
              <IcDescargar tamano={16} /> Descargar CSV
            </button>
          </div>
          <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontWeight: 600 }}>Conciliar con tu estado de cuenta</span>
            <span className="tenue" style={{ fontSize: 13.5, lineHeight: 1.5 }}>Sube el CSV de tu banco y te mostramos los pagos que no llegaron por notificación.</span>
            <button className="btn" onClick={() => setImportando(true)}>
              <IcSubir tamano={16} /> Importar estado de cuenta
            </button>
          </div>
          <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontWeight: 600 }}>Sesión</span>
            <span className="tenue" style={{ fontSize: 13.5 }}>{sesion?.user.email}</span>
            <button className="btn" onClick={() => void cerrarSesion()}>
              <IcSalir tamano={16} /> Cerrar sesión
            </button>
          </div>
        </div>
      </Seccion>
      <Importar abierto={importando} onCerrar={() => setImportando(false)} />
    </div>
  );
}

function EditorFuente({ fuente, metas }: { fuente?: FuenteIngreso; metas: Apartado[] }) {
  const { config, acciones } = useDatos();
  const { avisar, confirmar } = useAvisos();
  const [abierto, setAbierto] = useState(!!fuente);
  const [nombre, setNombre] = useState(fuente?.nombre ?? '');
  const [monto, setMonto] = useState(aTexto(fuente?.monto_esperado_centavos));
  const [cuenta, setCuenta] = useState(Math.max(0, config.cuentas.findIndex((c) => c.id === fuente?.cuenta_id)));
  const [quincenal, setQuincenal] = useState(fuente?.frecuencia === 'quincenal');
  const [reglas, setReglas] = useState<Record<string, number>>(() => Object.fromEntries(metas.map((m) => [m.id, fuente ? porcentajeDe(fuente.id, m.id, config.reglas, config.apartados) : 0])));
  const [guardando, setGuardando] = useState(false);
  const total = metas.reduce((a, m) => a + (reglas[m.id] ?? 0), 0);
  const centavos = leerMonto(monto) ?? 0;

  if (!abierto)
    return (
      <button className="card lift" onClick={() => setAbierto(true)} style={{ padding: 22, minHeight: 120, cursor: 'pointer', color: 'var(--texto2)', borderStyle: 'dashed', fontSize: 14 }}>
        + Agregar ingreso
      </button>
    );

  const guardar = async () => {
    if (!nombre.trim() || !centavos) return avisar('Escribe el nombre y el monto del ingreso.', true);
    setGuardando(true);
    try {
      const guardada = await acciones.guardarFuente({ id: fuente?.id, nombre: nombre.trim(), monto_esperado_centavos: centavos, frecuencia: quincenal ? 'quincenal' : 'mensual', cuenta_id: config.cuentas[cuenta]?.id ?? null });
      await acciones.guardarReglas(guardada.id, Object.entries(reglas).map(([apartado_id, porcentaje]) => ({ apartado_id, porcentaje })));
      if (!fuente) {
        setNombre('');
        setMonto('');
        setAbierto(false);
      }
      avisar('Guardado. Las reglas aplican a los próximos ingresos.');
    } catch (e) {
      avisar(errorTexto(e), true);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!fuente) return setAbierto(false);
    const ok = await confirmar({ titulo: '¿Quitar este ingreso?', texto: 'Los movimientos que ya tienes se conservan.', accion: 'Quitar', peligro: true });
    if (ok) await acciones.borrarFuente(fuente.id).catch((e) => avisar(errorTexto(e), true));
  };

  return (
    <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Ingreso principal" />
      <CampoDinero etiqueta="Monto al mes" valor={monto} onCambio={setMonto} />
      <div className="etiqueta">
        <span className="eyebrow">¿Cada cuándo te pagan?</span>
        <Segmentado etiqueta="Frecuencia" opciones={['Una vez al mes', 'Cada quincena']} valor={quincenal ? 1 : 0} onCambio={(i) => setQuincenal(i === 1)} />
        {quincenal && centavos > 0 && <span style={{ fontSize: 12, color: 'var(--texto3)' }}>Dos depósitos de {formatoMXN(Math.round(centavos / 2), { decimales: 'nunca' })}.</span>}
      </div>
      {config.cuentas.length > 0 && (
        <div className="etiqueta">
          <span className="eyebrow">Llega a</span>
          <Segmentado etiqueta="Llega a" opciones={config.cuentas.map((c) => c.alias)} valor={cuenta} onCambio={setCuenta} />
        </div>
      )}
      {metas.map((m) => (
        <Deslizador
          key={m.id}
          id={`f-${fuente?.id ?? 'nueva'}-${m.id}`}
          etiqueta={m.nombre}
          color={m.color}
          valor={reglas[m.id] ?? 0}
          maximo={100 - (total - (reglas[m.id] ?? 0))}
          detalle={`${formatoMXN(Math.round((centavos * (reglas[m.id] ?? 0)) / 100), { decimales: 'nunca' })} al mes`}
          onCambio={(v) => setReglas({ ...reglas, [m.id]: v })}
        />
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.12)', fontSize: 13.5 }}>
        <span>Gastos personales</span>
        <b style={{ fontWeight: 600 }}>
          {100 - total}% · {formatoMXN(Math.round((centavos * (100 - total)) / 100), { decimales: 'nunca' })}
        </b>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn peligro" style={{ flex: 1 }} onClick={() => void borrar()}>
          {fuente ? 'Quitar' : 'Cancelar'}
        </button>
        <button className="btn pri" style={{ flex: 2 }} disabled={guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : fuente ? 'Guardar' : 'Agregar'}
        </button>
      </div>
    </div>
  );
}

function EditorMeta({ meta, orden }: { meta?: Apartado; orden: number }) {
  const { acciones } = useDatos();
  const { avisar, confirmar } = useAvisos();
  const [abierto, setAbierto] = useState(!!meta);
  const [nombre, setNombre] = useState(meta?.nombre ?? '');
  const [objetivo, setObjetivo] = useState(aTexto(meta?.meta_centavos));
  const [inicial, setInicial] = useState(aTexto(meta?.saldo_inicial_centavos));
  const [destino, setDestino] = useState(meta?.destino ?? '');
  const [color, setColor] = useState(meta?.color ?? PALETA[orden % 2 === 0 ? 0 : 4]!);
  const [guardando, setGuardando] = useState(false);

  if (!abierto)
    return (
      <button className="card lift" onClick={() => setAbierto(true)} style={{ padding: 22, minHeight: 120, cursor: 'pointer', color: 'var(--texto2)', borderStyle: 'dashed', fontSize: 14 }}>
        + Agregar meta
      </button>
    );

  const guardar = async () => {
    if (!nombre.trim()) return avisar('Ponle nombre a tu meta.', true);
    setGuardando(true);
    try {
      await acciones.guardarApartado({
        id: meta?.id,
        nombre: nombre.trim(),
        tipo: 'meta',
        meta_centavos: leerMonto(objetivo),
        saldo_inicial_centavos: leerMonto(inicial) ?? 0,
        destino: destino.trim() || null,
        color,
        orden: meta?.orden ?? orden + 1,
      });
      if (!meta) {
        setNombre('');
        setObjetivo('');
        setInicial('');
        setDestino('');
        setAbierto(false);
      }
      avisar(meta ? 'Meta guardada.' : 'Meta creada. Decide qué parte de tus ingresos le toca.');
    } catch (e) {
      avisar(errorTexto(e), true);
    } finally {
      setGuardando(false);
    }
  };

  const archivar = async () => {
    if (!meta) return setAbierto(false);
    const ok = await confirmar({ titulo: '¿Archivar esta meta?', texto: 'Deja de recibir dinero de tus reglas. Su historial se conserva.', accion: 'Archivar', peligro: true });
    if (ok) await acciones.archivarApartado(meta.id).catch((e) => avisar(errorTexto(e), true));
  };

  return (
    <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Viaje" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <CampoDinero etiqueta="Meta" valor={objetivo} onCambio={setObjetivo} placeholder="Opcional" />
        <CampoDinero etiqueta="Ya llevabas" valor={inicial} onCambio={setInicial} placeholder="0" />
      </div>
      <Campo etiqueta="¿Dónde está el dinero?" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ej. Apartado en BBVA" />
      <div className="etiqueta">
        <span className="eyebrow">Color</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PALETA.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              style={{ width: 28, height: 28, borderRadius: 9, border: color === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)', background: c, cursor: 'pointer', transform: color === c ? 'scale(1.1)' : undefined, transition: 'transform .3s var(--resorte)' }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn peligro" style={{ flex: 1 }} onClick={() => void archivar()}>
          {meta ? 'Archivar' : 'Cancelar'}
        </button>
        <button className="btn pri" style={{ flex: 2 }} disabled={guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : meta ? 'Guardar' : 'Agregar'}
        </button>
      </div>
    </div>
  );
}

function EditorCuenta({ cuenta, esGastos, gastos }: { cuenta: Cuenta; esGastos: boolean; gastos: Apartado | null }) {
  const { acciones } = useDatos();
  const { avisar } = useAvisos();
  const [alias, setAlias] = useState(cuenta.alias);
  const [terminaciones, setTerminaciones] = useState(cuenta.terminaciones.join(', '));
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await acciones.guardarCuenta({ ...cuenta, alias: alias.trim() || cuenta.alias, terminaciones: digitos(terminaciones) });
      avisar('Cuenta guardada.');
    } catch (e) {
      avisar(errorTexto(e), true);
    } finally {
      setGuardando(false);
    }
  };

  const usarParaGastos = async () => {
    if (!gastos) return;
    try {
      await acciones.guardarApartado({ ...gastos, cuenta_id: cuenta.id });
      avisar(`Gastos personales ahora vive en ${cuenta.alias}.`);
    } catch (e) {
      avisar(errorTexto(e), true);
    }
  };

  return (
    <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>{cuenta.banco}</span>
        {esGastos && <span className="chip acc">Aquí vive Gastos personales</span>}
      </div>
      <Campo etiqueta="Nombre" value={alias} onChange={(e) => setAlias(e.target.value)} />
      <Campo etiqueta="Terminaciones" value={terminaciones} onChange={(e) => setTerminaciones(e.target.value)} inputMode="numeric" ayuda="Últimos 4 dígitos de tarjetas y cuentas, separados por coma." />
      <div style={{ display: 'flex', gap: 10 }}>
        {!esGastos && gastos && (
          <button className="btn" style={{ flex: 1 }} onClick={() => void usarParaGastos()}>
            Usar para gastos
          </button>
        )}
        <button className="btn pri" style={{ flex: 1 }} disabled={guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function EditorCategorias() {
  const { config, acciones } = useDatos();
  const { avisar } = useAvisos();
  const [nombre, setNombre] = useState('');
  const agregar = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    if (config.categorias.some((c) => c.nombre.toLowerCase() === limpio.toLowerCase())) return avisar('Esa categoría ya existe.', true);
    try {
      await acciones.guardarCategoria({ nombre: limpio, color: PALETA[config.categorias.length % PALETA.length]!, orden: config.categorias.length + 1 });
      setNombre('');
      avisar(`Categoría "${limpio}" agregada.`);
    } catch (e) {
      avisar(errorTexto(e), true);
    }
  };
  return (
    <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {config.categorias.map((c) => (
          <span key={c.id} className="chip" style={{ height: 32 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} />
            {c.nombre}
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void agregar();
        }}
        style={{ display: 'flex', gap: 10, maxWidth: 480 }}
      >
        <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nueva categoría · ej. Mascotas" aria-label="Nueva categoría" />
        <button className="btn" type="submit" disabled={!nombre.trim()}>
          Agregar
        </button>
      </form>
    </div>
  );
}
