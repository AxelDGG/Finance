import { useDatos } from '@finanzas/api';
import type { FilaEstado } from '@finanzas/core';
import { claveDia, conciliar, filasDeEstado, formatoMXN, leerCSV, limpiarComercio, sugerirCategoria, ubicarEncabezado } from '@finanzas/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { errorTexto } from '../lib/movimientos';
import { IcCerrar, IcSubir } from './iconos';
import { Dialogo, Segmentado, useAvisos } from './ui';

/**
 * Importa el estado de cuenta (CSV que descargas de BBVA o Santander) y lo
 * compara con lo registrado: así encuentras pagos cuya notificación no llegó.
 */
export function Importar({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { config, movimientos, acciones } = useDatos();
  const { avisar } = useAvisos();
  const [cuenta, setCuenta] = useState(0);
  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaEstado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  const [encima, setEncima] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setArchivo(null);
    setFilas(null);
    setError(null);
    const principal = config.cuentas.findIndex((c) => c.es_principal);
    setCuenta(principal >= 0 ? principal : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const cuentaId = config.cuentas[cuenta]?.id ?? null;
  const resultado = useMemo(() => (filas ? conciliar(filas, movimientos, cuentaId) : null), [filas, movimientos, cuentaId]);

  useEffect(() => {
    if (resultado) setElegidas(new Set(resultado.faltantes.map((_, i) => i)));
  }, [resultado]);

  const leer = async (f: File) => {
    setError(null);
    setFilas(null);
    setArchivo(f.name);
    try {
      // Los bancos a veces exportan en Latin-1: si UTF-8 trae caracteres rotos, reintentamos.
      const bytes = await f.arrayBuffer();
      let texto = new TextDecoder('utf-8').decode(bytes);
      if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(bytes);
      const tabla = leerCSV(texto);
      const encabezado = ubicarEncabezado(tabla);
      if (!encabezado) {
        setError('No reconocimos las columnas. El archivo debe tener Fecha, Descripción/Concepto y Cargo/Abono o Importe.');
        return;
      }
      const leidas = filasDeEstado(tabla.slice(encabezado.indice + 1), encabezado.columnas);
      if (leidas.length === 0) {
        setError('El archivo no tiene movimientos con fecha y monto.');
        return;
      }
      setFilas(leidas);
    } catch (e) {
      setError(errorTexto(e));
    }
  };

  const importar = async () => {
    if (!resultado) return;
    const gastos = config.apartados.find((a) => a.tipo === 'gastos');
    const lista = resultado.faltantes
      .filter((_, i) => elegidas.has(i))
      .map((f) => {
        const comercio = limpiarComercio(f.descripcion);
        const esGasto = f.monto < 0;
        return {
          tipo: esGasto ? ('gasto' as const) : ('ingreso' as const),
          monto_centavos: Math.abs(f.monto),
          fecha: f.fecha.toISOString(),
          comercio,
          descripcion: f.descripcion || null,
          cuenta_id: cuentaId,
          categoria_id: esGasto ? sugerirCategoria(comercio, config.reglasCategoria, config.categorias) : null,
          apartado_id: esGasto ? (gastos?.id ?? null) : null,
          origen: 'importado' as const,
        };
      });
    if (lista.length === 0) return;
    setGuardando(true);
    try {
      const n = await acciones.importarMovimientos(lista);
      avisar(`Agregamos ${n} ${n === 1 ? 'movimiento' : 'movimientos'} de tu estado de cuenta.`);
      onCerrar();
    } catch (e) {
      avisar(errorTexto(e), true);
    } finally {
      setGuardando(false);
    }
  };

  const alternar = (i: number) => {
    const s = new Set(elegidas);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    setElegidas(s);
  };

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} ancho etiqueta="Importar estado de cuenta">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 className="metal display" style={{ margin: 0, fontSize: 30 }}>IMPORTAR ESTADO DE CUENTA</h2>
          <button className="btn sq" onClick={onCerrar} aria-label="Cerrar">
            <IcCerrar tamano={16} />
          </button>
        </div>
        <p className="tenue" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
          Descarga tus movimientos en CSV desde la banca en línea de BBVA o Santander y súbelos aquí. Te mostramos lo que <b style={{ color: 'var(--texto)' }}>no</b> se registró por notificación para que lo agregues.
        </p>
        {config.cuentas.length > 1 && (
          <div className="etiqueta">
            <span className="eyebrow">¿De qué cuenta es?</span>
            <Segmentado etiqueta="Cuenta del estado" opciones={config.cuentas.map((c) => c.alias)} valor={cuenta} onCambio={setCuenta} estilo={{ maxWidth: 420 }} />
          </div>
        )}
        <button
          className="card"
          onClick={() => entrada.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault();
            setEncima(false);
            const f = e.dataTransfer.files[0];
            if (f) void leer(f);
          }}
          style={{ padding: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', borderStyle: 'dashed', borderColor: encima ? 'rgba(183,173,255,0.6)' : undefined, background: encima ? 'rgba(154,141,242,0.08)' : undefined, color: 'inherit' }}
        >
          <IcSubir tamano={22} style={{ color: 'var(--acento-claro)' }} />
          <span style={{ fontWeight: 600 }}>{archivo ?? 'Elige o arrastra tu archivo CSV'}</span>
          <span className="tenue" style={{ fontSize: 12.5 }}>Se lee en tu computadora; solo se guardan los movimientos que elijas.</span>
        </button>
        <input
          ref={entrada}
          type="file"
          accept=".csv,.txt,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void leer(f);
            e.target.value = '';
          }}
        />
        {error && (
          <div role="alert" style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(242,167,167,0.35)', background: 'rgba(242,167,167,0.08)', color: 'var(--peligro)', fontSize: 13.5 }}>
            {error}
          </div>
        )}
        {resultado && (
          <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="chip">{filas?.length} en el archivo</span>
              <span className="chip">{resultado.encontradas.length} ya estaban</span>
              <span className="chip acc">{resultado.faltantes.length} no estaban</span>
            </div>
            {resultado.faltantes.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14 }}>Todo coincide: la captura automática no se perdió nada. 🎉</p>
            ) : (
              <div className="desliza-x" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          aria-label="Elegir todos"
                          checked={elegidas.size === resultado.faltantes.length}
                          onChange={(e) => setElegidas(e.target.checked ? new Set(resultado.faltantes.map((_, i) => i)) : new Set())}
                        />
                      </th>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.faltantes.map((f, i) => (
                      <tr key={i} onClick={() => alternar(i)} style={{ cursor: 'pointer', opacity: elegidas.has(i) ? 1 : 0.5 }}>
                        <td>
                          <input type="checkbox" checked={elegidas.has(i)} onChange={() => alternar(i)} onClick={(e) => e.stopPropagation()} aria-label={`Importar ${f.descripcion}`} />
                        </td>
                        <td className="mono" style={{ whiteSpace: 'nowrap' }}>{claveDia(f.fecha)}</td>
                        <td>{f.descripcion}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: f.monto > 0 ? '#CFC8FF' : undefined, whiteSpace: 'nowrap' }}>
                          {f.monto > 0 ? '+' : '−'}
                          {formatoMXN(Math.abs(f.monto))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {resultado.faltantes.length > 0 && (
              <button className="btn pri" disabled={guardando || elegidas.size === 0} onClick={() => void importar()} style={{ minHeight: 50 }}>
                {guardando ? 'Agregando…' : `Agregar ${elegidas.size} ${elegidas.size === 1 ? 'movimiento' : 'movimientos'}`}
              </button>
            )}
          </div>
        )}
      </div>
    </Dialogo>
  );
}
