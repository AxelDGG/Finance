import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { IcCheck, IcAlerta } from './iconos';

/** Anima un número hacia su nuevo valor (montos que "cuentan"). */
export function useContador(objetivo: number, duracion = 900): number {
  const [valor, setValor] = useState(objetivo);
  const desde = useRef(objetivo);
  useEffect(() => {
    const inicio = performance.now();
    const origen = desde.current;
    if (origen === objetivo) return;
    let cuadro = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      const suave = 1 - Math.pow(1 - t, 3);
      const v = origen + (objetivo - origen) * suave;
      desde.current = v;
      setValor(v);
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [objetivo, duracion]);
  return valor;
}

export function Segmentado({ opciones, valor, onCambio, etiqueta, estilo }: { opciones: string[]; valor: number; onCambio: (i: number) => void; etiqueta: string; estilo?: CSSProperties }) {
  const n = Math.max(1, opciones.length);
  return (
    <div className="seg" role="group" aria-label={etiqueta} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, ...estilo }}>
      <span className="seg-thumb" style={{ width: `calc((100% - 8px) / ${n})`, transform: `translateX(${valor * 100}%)` }} />
      {opciones.map((o, i) => (
        <button key={o + i} type="button" className={`seg-btn ${i === valor ? 'on' : ''}`} onClick={() => onCambio(i)} aria-pressed={i === valor}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Barra({ valor, alto = 8, fondo = 'linear-gradient(90deg, #6F737D, #E2E3E7)', retraso = 0 }: { valor: number; alto?: number; fondo?: string; retraso?: number }) {
  return (
    <span className="track" style={{ height: alto }}>
      <span className="fill" style={{ width: `${Math.max(0, Math.min(100, valor))}%`, background: fondo, animationDelay: `${retraso}ms` }} />
    </span>
  );
}

export function Anillo({ valor, tamano = 132, grosor = 10, color, children }: { valor: number; tamano?: number; grosor?: number; color: string; children?: ReactNode }) {
  const r = tamano / 2 - grosor / 2 - 4;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(1, valor)));
  return (
    <div style={{ position: 'relative', flex: 'none', width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} aria-hidden="true" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={grosor} />
        <circle
          className="anillo"
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill="none"
          strokeWidth={grosor}
          strokeLinecap="round"
          style={{ stroke: color, strokeDasharray: circ, strokeDashoffset: off, filter: `drop-shadow(0 0 8px ${color}66)`, ['--circ' as string]: `${circ}` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>{children}</div>
    </div>
  );
}

export function Campo({ etiqueta, ayuda, ...props }: { etiqueta: string; ayuda?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label className="etiqueta" htmlFor={id}>
      <span className="eyebrow">{etiqueta}</span>
      <input id={id} className="input" {...props} />
      {ayuda && <span style={{ fontSize: 12, color: 'var(--texto3)' }}>{ayuda}</span>}
    </label>
  );
}

/** Campo de dinero: acepta "1,250.50" y muestra el signo de pesos. */
export function CampoDinero({ etiqueta, valor, onCambio, grande, ...props }: { etiqueta: string; valor: string; onCambio: (t: string) => void; grande?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const id = useId();
  return (
    <label className="etiqueta" htmlFor={id}>
      <span className="eyebrow">{etiqueta}</span>
      <span style={{ position: 'relative', display: 'block' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto3)', fontFamily: grande ? 'Anton, sans-serif' : undefined, fontSize: grande ? 32 : 14 }}>
          $
        </span>
        <input
          id={id}
          className={`input ${grande ? 'grande' : ''}`}
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={(e) => onCambio(e.target.value.replace(/[^\d.,]/g, ''))}
          style={{ paddingLeft: grande ? 40 : 28 }}
          {...props}
        />
      </span>
    </label>
  );
}

export function Dialogo({ abierto, onCerrar, children, ancho, etiqueta }: { abierto: boolean; onCerrar: () => void; children: ReactNode; ancho?: boolean; etiqueta: string }) {
  const caja = useRef<HTMLDivElement>(null);
  // En un ref para que escribir (que re-renderiza al padre) no vuelva a mover el foco.
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    if (!abierto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current();
    window.addEventListener('keydown', tecla);
    // Foco al primer campo para escribir de inmediato (el diálogo ya está montado).
    (caja.current?.querySelector<HTMLElement>('input, select, textarea, button.cpick, button.btn.pri') ?? caja.current)?.focus();
    return () => {
      window.removeEventListener('keydown', tecla);
      anterior?.focus?.();
    };
  }, [abierto]);
  if (!abierto) return null;
  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={caja} className={`dialogo ${ancho ? 'ancho' : ''}`} role="dialog" aria-modal="true" aria-label={etiqueta} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- avisos y confirmaciones

interface Aviso {
  id: number;
  texto: string;
  error: boolean;
}
interface Confirmacion {
  titulo: string;
  texto: string;
  accion: string;
  peligro?: boolean;
  resolver: (ok: boolean) => void;
}
interface ValorAvisos {
  avisar: (texto: string, error?: boolean) => void;
  confirmar: (c: Omit<Confirmacion, 'resolver'>) => Promise<boolean>;
}

const ContextoAvisos = createContext<ValorAvisos | null>(null);

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  const avisar = useCallback((texto: string, error = false) => {
    clearTimeout(temporizador.current);
    setAviso({ id: Date.now(), texto, error });
    temporizador.current = setTimeout(() => setAviso(null), error ? 6000 : 3800);
  }, []);
  const confirmar = useCallback((c: Omit<Confirmacion, 'resolver'>) => new Promise<boolean>((resolver) => setConfirmacion({ ...c, resolver })), []);
  const responder = (ok: boolean) => {
    confirmacion?.resolver(ok);
    setConfirmacion(null);
  };

  return (
    <ContextoAvisos.Provider value={{ avisar, confirmar }}>
      {children}
      {aviso && (
        <div key={aviso.id} className={`toast ${aviso.error ? 'error' : ''}`} role={aviso.error ? 'alert' : 'status'} onClick={() => setAviso(null)}>
          <span style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 10, flex: 'none', background: aviso.error ? 'rgba(242,167,167,0.14)' : 'var(--acento)', color: aviso.error ? 'var(--peligro)' : '#0A0B0D' }}>
            {aviso.error ? <IcAlerta tamano={16} /> : <IcCheck tamano={16} />}
          </span>
          <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>{aviso.texto}</span>
        </div>
      )}
      <Dialogo abierto={!!confirmacion} onCerrar={() => responder(false)} etiqueta={confirmacion?.titulo ?? ''}>
        {confirmacion && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>{confirmacion.titulo}</h2>
            <p className="tenue" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{confirmacion.texto}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button className="btn" onClick={() => responder(false)}>Cancelar</button>
              <button className={`btn ${confirmacion.peligro ? 'peligro' : 'pri'}`} onClick={() => responder(true)} autoFocus>
                {confirmacion.accion}
              </button>
            </div>
          </div>
        )}
      </Dialogo>
    </ContextoAvisos.Provider>
  );
}

export function useAvisos(): ValorAvisos {
  const v = useContext(ContextoAvisos);
  if (!v) throw new Error('useAvisos debe usarse dentro de <AvisosProvider>');
  return v;
}

export function Vacio({ titulo, texto, children }: { titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '36px 16px', textAlign: 'center' }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</span>
      <span className="tenue" style={{ fontSize: 13.5, maxWidth: 380, lineHeight: 1.5 }}>{texto}</span>
      {children}
    </div>
  );
}
