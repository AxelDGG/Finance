import { useDatos } from '@finanzas/api';
import type { Movimiento } from '@finanzas/core';
import { claveDia, esGasto, esIngreso, etiquetaDia, exportarCSV, formatoMXN, nombrePeriodo, normalizar, periodoDe } from '@finanzas/core';
import { useEffect, useMemo, useState } from 'react';
import { DetalleMovimiento, FilaMovimiento } from '../componentes/movimientos';
import { IcBuscar, IcCerrar, IcDescargar, IcSubir } from '../componentes/iconos';
import { Importar } from '../componentes/Importar';
import { Segmentado, useAvisos, Vacio } from '../componentes/ui';
import { navegar, type Ruta } from '../lib/ruta';
import { descargar, enEscritorio } from '../lib/tauri';
import { nombreMovimiento } from '../lib/movimientos';

const FILTROS = ['Todos', 'Gastos', 'Ingresos', 'Internos'];
const TIPOS: Array<Movimiento['tipo'] | null> = [null, 'gasto', 'ingreso', 'interno'];
const POR_PAGINA = 60;

export function Movimientos({ ruta }: { ruta: Ruta }) {
  const { movimientos, config } = useDatos();
  const { avisar } = useAvisos();
  const [filtro, setFiltro] = useState(0);
  const [mes, setMes] = useState<string>('todos');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [importando, setImportando] = useState(false);
  const q = ruta.params.get('q') ?? '';
  const cuentaId = ruta.params.get('cuenta');
  const catId = ruta.params.get('cat');
  const categoria = config.categorias.find((c) => c.id === catId);
  const selId = ruta.params.get('sel');
  const cuenta = config.cuentas.find((c) => c.id === cuentaId);
  const seleccionado = movimientos.find((m) => m.id === selId) ?? null;

  const meses = useMemo(() => [...new Set(movimientos.map((m) => periodoDe(m.fecha)))].sort().reverse(), [movimientos]);

  const lista = useMemo(() => {
    const tipo = TIPOS[filtro];
    const busqueda = normalizar(q);
    return movimientos.filter(
      (m) =>
        (!tipo || m.tipo === tipo) &&
        (!cuentaId || m.cuenta_id === cuentaId) &&
        (!catId || m.categoria_id === catId) &&
        (mes === 'todos' || periodoDe(m.fecha) === mes) &&
        (!busqueda || normalizar(`${nombreMovimiento(m, config)} ${m.descripcion ?? ''}`).includes(busqueda)),
    );
  }, [movimientos, filtro, cuentaId, catId, mes, q, config]);

  useEffect(() => setLimite(POR_PAGINA), [filtro, cuentaId, catId, mes, q]);

  const sumaGastos = lista.filter(esGasto).reduce((a, m) => a + m.monto_centavos, 0);
  const sumaIngresos = lista.filter(esIngreso).reduce((a, m) => a + m.monto_centavos, 0);
  const visibles = lista.slice(0, limite);

  // Agrupar por día con el total gastado de cada día.
  const grupos: Array<{ clave: string; etiqueta: string; total: number; movs: Movimiento[] }> = [];
  for (const m of visibles) {
    const clave = claveDia(m.fecha);
    let g = grupos[grupos.length - 1];
    if (!g || g.clave !== clave) {
      g = { clave, etiqueta: etiquetaDia(m.fecha), total: 0, movs: [] };
      grupos.push(g);
    }
    g.movs.push(m);
    if (esGasto(m)) g.total += m.monto_centavos;
  }

  const abrir = (m: Movimiento) => navegar('movimientos', { q, cuenta: cuentaId, cat: catId, sel: m.id === selId ? null : m.id }, true);
  const buscar = (texto: string) => navegar('movimientos', { q: texto, cuenta: cuentaId, cat: catId, sel: selId }, true);

  const exportar = () => {
    if (lista.length === 0) return avisar('No hay movimientos para exportar con ese filtro.', true);
    const sufijo = mes === 'todos' ? 'todos' : mes;
    descargar(`finanzas-movimientos-${sufijo}.csv`, exportarCSV(lista, config.categorias, config.cuentas));
    avisar(`Exportamos ${lista.length} movimientos${enEscritorio ? ' a tu carpeta de Descargas' : ''}.`);
  };

  let indice = 0;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <section className="card rise" style={{ flex: '999 1 520px', minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, animationDelay: '60ms' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <Segmentado etiqueta="Tipo de movimiento" opciones={FILTROS} valor={filtro} onCambio={setFiltro} estilo={{ flex: '1 1 360px', maxWidth: 480 }} />
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
            <IcBuscar tamano={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--tenue)' }} />
            <input className="input con-icono" type="search" aria-label="Buscar comercio" placeholder="Buscar comercio" value={q} onChange={(e) => buscar(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 4px', alignItems: 'center' }}>
          <select className="input" aria-label="Mes" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: 'auto', height: 30, padding: '0 12px', borderRadius: 99, fontSize: 12.5 }}>
            <option value="todos">Todos los meses</option>
            {meses.map((p) => (
              <option key={p} value={p}>
                {nombrePeriodo(p, true).replace(/^./, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          {cuenta && (
            <button className="chip acc" onClick={() => navegar('movimientos', { q, cat: catId }, true)} aria-label={`Quitar filtro de cuenta ${cuenta.alias}`}>
              Cuenta: {cuenta.alias} <IcCerrar tamano={11} grosor={2.4} />
            </button>
          )}
          {categoria && (
            <button className="chip acc" onClick={() => navegar('movimientos', { q, cuenta: cuentaId }, true)} aria-label={`Quitar filtro de categoría ${categoria.nombre}`}>
              Categoría: {categoria.nombre} <IcCerrar tamano={11} grosor={2.4} />
            </button>
          )}
          <span className="chip">
            {lista.length} {lista.length === 1 ? 'movimiento' : 'movimientos'}
          </span>
          <span className="chip">Gastos {formatoMXN(sumaGastos, { decimales: 'nunca' })}</span>
          <span className="chip acc">Ingresos {formatoMXN(sumaIngresos, { decimales: 'nunca' })}</span>
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={() => setImportando(true)} title="Compara tu estado de cuenta con lo registrado">
            <IcSubir tamano={15} /> Importar estado
          </button>
          <button className="btn sm" onClick={exportar}>
            <IcDescargar tamano={15} /> Exportar CSV
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {grupos.map((g) => (
            <div key={g.clave} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 12px 4px' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#C9CBD1' }}>{g.etiqueta}</span>
                {g.total > 0 && <span className="mono" style={{ fontSize: 11.5, color: 'var(--tenue)' }}>−{formatoMXN(g.total)}</span>}
              </div>
              {g.movs.map((m) => {
                const i = indice++;
                return <FilaMovimiento key={m.id} m={m} activo={m.id === selId} onAbrir={() => abrir(m)} retraso={i < 14 ? 80 + i * 35 : undefined} />;
              })}
            </div>
          ))}
          {lista.length === 0 && <Vacio titulo={q ? 'Sin resultados' : 'Nada por aquí'} texto={q ? `No hay movimientos que coincidan con "${q}".` : 'No hay movimientos con ese filtro.'} />}
          {lista.length > limite && (
            <button className="btn" style={{ marginTop: 12 }} onClick={() => setLimite(limite + POR_PAGINA)}>
              Ver más ({lista.length - limite} restantes)
            </button>
          )}
        </div>
      </section>

      {seleccionado && <DetalleMovimiento m={seleccionado} onCerrar={() => navegar('movimientos', { q, cuenta: cuentaId, cat: catId }, true)} />}
      <Importar abierto={importando} onCerrar={() => setImportando(false)} />
    </div>
  );
}
