import { useDatos, type ConfiguracionInicial } from '@finanzas/api';
import type { Banco } from '@finanzas/core';
import { formatoMXN, leerMonto } from '@finanzas/core';
import { useState } from 'react';
import { Deslizador } from '../componentes/Deslizador';
import { Campo, CampoDinero, Segmentado, useAvisos } from '../componentes/ui';
import { errorTexto } from '../lib/movimientos';
import { PALETA } from '../lib/tema';

type ClaveBanco = 'bbva' | 'santander';
const BANCOS: Array<{ clave: ClaveBanco; banco: Banco; nombre: string }> = [
  { clave: 'bbva', banco: 'BBVA', nombre: 'BBVA' },
  { clave: 'santander', banco: 'Santander', nombre: 'Santander' },
];

interface FuenteBorrador {
  nombre: string;
  monto: string;
  quincenal: boolean;
  cuenta: ClaveBanco;
  reglas: Record<string, number>;
}
interface MetaBorrador {
  clave: string;
  nombre: string;
  meta: string;
  ahorrado: string;
  destino: string;
}

const PASOS = ['Cuentas', 'Ingresos', 'Metas', 'Reparto'];
const soloDigitos = (t: string) =>
  t
    .split(/[,\s]+/)
    .map((x) => x.replace(/\D/g, ''))
    .filter((x) => x.length === 4);

/**
 * Asistente de 4 pasos la primera vez (igual que en el teléfono). Empieza en
 * blanco: tus bancos, ingresos y metas se guardan en tu cuenta, no en el código.
 */
export function Bienvenida() {
  const { acciones } = useDatos();
  const { avisar } = useAvisos();
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [usados, setUsados] = useState<Record<ClaveBanco, boolean>>({ bbva: false, santander: false });
  const [terminaciones, setTerminaciones] = useState<Record<ClaveBanco, string>>({ bbva: '', santander: '' });
  const [cuentaGastos, setCuentaGastos] = useState<ClaveBanco>('bbva');
  const [fuentes, setFuentes] = useState<FuenteBorrador[]>([{ nombre: '', monto: '', quincenal: false, cuenta: 'bbva', reglas: {} }]);
  const [metas, setMetas] = useState<MetaBorrador[]>([]);

  const elegidos = BANCOS.filter((b) => usados[b.clave]);
  const cambiarFuente = (i: number, cambios: Partial<FuenteBorrador>) => setFuentes((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  const cambiarMeta = (i: number, cambios: Partial<MetaBorrador>) => setMetas((ms) => ms.map((m, j) => (j === i ? { ...m, ...cambios } : m)));
  const fuentesValidas = fuentes.filter((f) => f.nombre.trim() && leerMonto(f.monto));

  const alternarBanco = (clave: ClaveBanco) => setUsados((antes) => ({ ...antes, [clave]: !antes[clave] }));
  // Si quitas un banco, lo que apuntaba a él pasa al primero que sí usas.
  const bancoValido = (clave: ClaveBanco): ClaveBanco => (usados[clave] ? clave : (elegidos[0]?.clave ?? clave));

  const siguiente = () => {
    if (paso === 0 && elegidos.length === 0) return avisar('Elige al menos un banco.', true);
    if (paso === 1 && fuentesValidas.length === 0) return avisar('Agrega al menos un ingreso con su nombre y monto.', true);
    if (paso < PASOS.length - 1) setPaso(paso + 1);
    else void terminar();
  };

  const terminar = async () => {
    const config: ConfiguracionInicial = {
      cuentas: elegidos.map((b) => ({ clave: b.clave, banco: b.banco, alias: b.nombre, terminaciones: soloDigitos(terminaciones[b.clave]), es_principal: bancoValido(cuentaGastos) === b.clave })),
      cuentaGastos: bancoValido(cuentaGastos),
      fuentes: fuentesValidas.map((f) => ({ nombre: f.nombre.trim(), cuenta: bancoValido(f.cuenta), monto_esperado_centavos: leerMonto(f.monto)!, frecuencia: f.quincenal ? 'quincenal' : 'mensual', reglas: f.reglas })),
      metas: metas
        .filter((m) => m.nombre.trim())
        .map((m, i) => ({
          clave: m.clave,
          nombre: m.nombre.trim(),
          descripcion: null,
          meta_centavos: leerMonto(m.meta),
          saldo_inicial_centavos: leerMonto(m.ahorrado) ?? 0,
          destino: m.destino.trim() || null,
          color: PALETA[i % 2 === 0 ? 0 : 4]!,
        })),
    };
    setGuardando(true);
    try {
      await acciones.aplicarConfiguracionInicial(config);
      avisar('¡Listo! Ahora vincula tu teléfono Android para capturar tus pagos.');
    } catch (e) {
      avisar(errorTexto(e), true);
    } finally {
      setGuardando(false);
    }
  };

  const opcionesBanco = elegidos.map((b) => b.nombre);
  const indiceBanco = (clave: ClaveBanco) => Math.max(0, elegidos.findIndex((b) => b.clave === clave));

  return (
    <main className="acceso" style={{ alignItems: 'start' }}>
      <div style={{ width: 'min(760px, 100%)', display: 'flex', flexDirection: 'column', gap: 22, padding: '24px 0 48px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="eyebrow">
            Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}
          </span>
          <h1 className="metal display viewin" style={{ margin: 0, fontSize: 'clamp(44px, 7vw, 72px)' }}>CONFIGURA TU APP</h1>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {PASOS.map((p, i) => (
              <span key={p} style={{ flex: i === paso ? 3 : 1, height: 4, borderRadius: 4, background: i <= paso ? 'var(--acento)' : 'rgba(255,255,255,0.07)', transition: 'flex .6s var(--resorte), background .4s' }} />
            ))}
          </div>
        </div>

        <div key={paso} className="slidein" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {paso === 0 && (
            <>
              <p className="tenue" style={{ margin: 0, lineHeight: 1.55 }}>
                ¿Qué bancos usas? Finanzas lee los avisos de sus apps (y los de Google Wallet) para registrar tus pagos solos.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {BANCOS.map((b) => (
                  <button key={b.clave} type="button" className={`cpick ${usados[b.clave] ? 'on' : ''}`} onClick={() => alternarBanco(b.clave)} aria-pressed={usados[b.clave]} style={{ minHeight: 46, padding: '0 22px', fontSize: 14 }}>
                    {b.nombre}
                  </button>
                ))}
              </div>
              {elegidos.length > 0 && (
                <>
                  <p className="tenue" style={{ margin: 0, lineHeight: 1.55 }}>
                    Escribe los últimos 4 dígitos de tus tarjetas o cuentas (opcional). Sirven para saber de qué cuenta salió cada pago y para reconocer cuando mueves dinero entre ellas.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
                    {elegidos.map((b) => (
                      <div key={b.clave} className="card rise" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <span style={{ fontWeight: 600 }}>{b.nombre}</span>
                        <Campo etiqueta="Terminaciones" value={terminaciones[b.clave]} onChange={(e) => setTerminaciones({ ...terminaciones, [b.clave]: e.target.value })} placeholder="Ej. 1234, 5678" inputMode="numeric" />
                      </div>
                    ))}
                  </div>
                  {elegidos.length > 1 && (
                    <div className="card rise" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <span style={{ fontWeight: 600 }}>¿Dónde está tu dinero para gastar?</span>
                      <span className="tenue" style={{ fontSize: 13 }}>Ahí vive "Gastos personales". Lo que llegue a la otra cuenta te pediremos pasarlo.</span>
                      <Segmentado etiqueta="Cuenta de gastos" opciones={opcionesBanco} valor={indiceBanco(bancoValido(cuentaGastos))} onCambio={(i) => setCuentaGastos(elegidos[i]!.clave)} estilo={{ maxWidth: 360 }} />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {paso === 1 && (
            <>
              <p className="tenue" style={{ margin: 0, lineHeight: 1.55 }}>
                Tus ingresos de cada mes y a qué cuenta llegan. Cuando llegue un depósito parecido, la app lo reconocerá y lo repartirá.
              </p>
              {fuentes.map((f, i) => (
                <div key={i} className="card rise" style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 14, alignItems: 'end', animationDelay: `${i * 70}ms` }}>
                  <Campo etiqueta="Nombre" value={f.nombre} onChange={(e) => cambiarFuente(i, { nombre: e.target.value })} placeholder="Ej. Sueldo" />
                  <CampoDinero etiqueta="Monto al mes" valor={f.monto} onCambio={(t) => cambiarFuente(i, { monto: t })} placeholder="0" />
                  <div className="etiqueta">
                    <span className="eyebrow">¿Cada cuándo?</span>
                    <Segmentado etiqueta="Frecuencia" opciones={['Al mes', 'Quincenal']} valor={f.quincenal ? 1 : 0} onCambio={(k) => cambiarFuente(i, { quincenal: k === 1 })} />
                  </div>
                  {elegidos.length > 1 && (
                    <div className="etiqueta">
                      <span className="eyebrow">Llega a</span>
                      <Segmentado etiqueta="Llega a" opciones={opcionesBanco} valor={indiceBanco(bancoValido(f.cuenta))} onCambio={(k) => cambiarFuente(i, { cuenta: elegidos[k]!.clave })} />
                    </div>
                  )}
                  {fuentes.length > 1 && (
                    <button className="btn sm peligro" style={{ justifySelf: 'start' }} onClick={() => setFuentes((fs) => fs.filter((_, j) => j !== i))}>
                      Quitar este ingreso
                    </button>
                  )}
                </div>
              ))}
              <button className="btn" onClick={() => setFuentes((fs) => [...fs, { nombre: '', monto: '', quincenal: false, cuenta: elegidos[0]?.clave ?? 'bbva', reglas: {} }])}>
                Agregar otro ingreso
              </button>
            </>
          )}

          {paso === 2 && (
            <>
              <p className="tenue" style={{ margin: 0, lineHeight: 1.55 }}>
                Tus metas son apartados reales (otra cuenta o un apartado del banco). Pon cuánto quieres juntar y cuánto llevas hoy. Puedes saltarte este paso y agregarlas después.
              </p>
              {metas.map((m, i) => (
                <div key={m.clave} className="card rise" style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 14, alignItems: 'end', animationDelay: `${i * 70}ms` }}>
                  <Campo etiqueta="Nombre" value={m.nombre} onChange={(e) => cambiarMeta(i, { nombre: e.target.value })} placeholder="Ej. Viaje, fondo de emergencia" />
                  <CampoDinero etiqueta="Meta" valor={m.meta} onCambio={(t) => cambiarMeta(i, { meta: t })} placeholder="Opcional" />
                  <CampoDinero etiqueta="Ya llevas" valor={m.ahorrado} onCambio={(t) => cambiarMeta(i, { ahorrado: t })} placeholder="0" />
                  <Campo etiqueta="¿Dónde está el dinero?" value={m.destino} onChange={(e) => cambiarMeta(i, { destino: e.target.value })} placeholder="Ej. Apartado del banco" />
                  <button className="btn sm peligro" style={{ justifySelf: 'start' }} onClick={() => setMetas((ms) => ms.filter((_, j) => j !== i))}>
                    Quitar esta meta
                  </button>
                </div>
              ))}
              <button className="btn" onClick={() => setMetas((ms) => [...ms, { clave: `meta${Date.now()}`, nombre: '', meta: '', ahorrado: '', destino: '' }])}>
                Agregar meta
              </button>
            </>
          )}

          {paso === 3 && (
            <>
              <p className="tenue" style={{ margin: 0, lineHeight: 1.55 }}>
                {metas.some((m) => m.nombre.trim())
                  ? 'Qué parte de cada ingreso va a cada meta. Lo que no apartes se queda en Gastos personales.'
                  : 'Sin metas por ahora: todo tu ingreso queda en Gastos personales. Puedes crear metas cuando quieras.'}
              </p>
              {fuentesValidas.map((f, i) => {
                const metasValidas = metas.filter((m) => m.nombre.trim());
                const total = metasValidas.reduce((a, m) => a + (f.reglas[m.clave] ?? 0), 0);
                const monto = leerMonto(f.monto) ?? 0;
                const indice = fuentes.indexOf(f);
                return (
                  <div key={i} className="card rise" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18, animationDelay: `${i * 70}ms` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, fontSize: 16 }}>{f.nombre}</span>
                      <span className="display" style={{ fontSize: 26 }}>{formatoMXN(monto, { decimales: 'nunca' })}</span>
                    </div>
                    {metasValidas.map((m, k) => {
                      const pct = f.reglas[m.clave] ?? 0;
                      return (
                        <Deslizador
                          key={m.clave}
                          id={`r-${i}-${m.clave}`}
                          etiqueta={m.nombre}
                          color={PALETA[k % 2 === 0 ? 0 : 4]!}
                          valor={pct}
                          maximo={100 - (total - pct)}
                          detalle={`${formatoMXN(Math.round((monto * pct) / 100), { decimales: 'nunca' })} al mes`}
                          onCambio={(v) => cambiarFuente(indice, { reglas: { ...f.reglas, [m.clave]: v } })}
                        />
                      );
                    })}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: '#E2E3E7' }} />
                        Gastos personales <span style={{ color: 'var(--texto3)' }}>(lo que sobra)</span>
                      </span>
                      <span style={{ fontSize: 13, color: '#9A9DA6' }}>
                        <b style={{ color: '#fff', fontWeight: 600 }}>{100 - total}%</b> · {formatoMXN(Math.round((monto * (100 - total)) / 100), { decimales: 'nunca' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {paso > 0 && (
            <button className="btn" onClick={() => setPaso(paso - 1)}>
              Atrás
            </button>
          )}
          <button className="btn pri" style={{ minWidth: 180 }} disabled={guardando} onClick={siguiente}>
            {guardando ? 'Guardando…' : paso < PASOS.length - 1 ? 'Siguiente' : 'Terminar'}
          </button>
        </div>
      </div>
    </main>
  );
}
