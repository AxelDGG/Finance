import { useEffect, useRef, useState } from 'react';
import { alternarMaximizar, arrastrarVentana, cerrarVentana, minimizar } from '../lib/tauri';
import { navegar, type Ruta } from '../lib/ruta';
import { IcBuscar } from './iconos';
import { Logo } from './Logo';

/** Barra de título propia de la app de escritorio: buscador (Ctrl K) y botones de ventana. */
export function BarraTitulo({ ruta }: { ruta: Ruta }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState(ruta.vista === 'movimientos' ? (ruta.params.get('q') ?? '') : '');

  useEffect(() => {
    if (ruta.vista !== 'movimientos') setTexto('');
  }, [ruta.vista]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        entrada.current?.focus();
        entrada.current?.select();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const buscar = (q: string) => {
    setTexto(q);
    navegar('movimientos', { q, cuenta: ruta.params.get('cuenta') }, ruta.vista === 'movimientos');
  };

  // Arrastrar desde la barra mueve la ventana; doble clic la maximiza.
  const alPresionar = (e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, label, input')) return;
    if (e.detail === 2) void alternarMaximizar();
    else void arrastrarVentana();
  };

  return (
    <div className="titlebar" onMouseDown={alPresionar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 18, minWidth: 0 }}>
        <Logo tamano={20} className="" />
        <span style={{ fontSize: 12.5, color: 'var(--texto2)' }}>Finanzas</span>
      </div>
      <label className="cmd">
        <IcBuscar tamano={14} />
        <input
          ref={entrada}
          type="search"
          aria-label="Buscar movimientos"
          placeholder="Buscar movimientos, comercios…"
          value={texto}
          onChange={(e) => buscar(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && (buscar(''), entrada.current?.blur())}
        />
        <kbd className="kbd">Ctrl K</kbd>
      </label>
      <div style={{ display: 'flex', alignSelf: 'stretch' }}>
        <button className="wbtn" aria-label="Minimizar" onClick={() => void minimizar()}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5.5h10" stroke="currentColor" strokeWidth="1" /></svg>
        </button>
        <button className="wbtn" aria-label="Maximizar" onClick={() => void alternarMaximizar()}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
        </button>
        <button className="wbtn cerrar" aria-label="Cerrar" onClick={() => void cerrarVentana()}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" /></svg>
        </button>
      </div>
    </div>
  );
}
