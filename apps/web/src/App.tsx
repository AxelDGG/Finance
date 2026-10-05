import { DatosProvider, useDatos } from '@finanzas/api';
import { nombreDia, nombreMes, partes } from '@finanzas/core';
import { useEffect, useState } from 'react';
import { BarraTitulo } from './componentes/BarraTitulo';
import { IcCampana, IcMas } from './componentes/iconos';
import { NuevoGasto } from './componentes/movimientos';
import { Sidebar } from './componentes/Sidebar';
import { AvisosProvider } from './componentes/ui';
import { enDemo, salirDemo } from './lib/demo';
import { useRuta, navegar, type Ruta } from './lib/ruta';
import { supabase, URL_SUPABASE } from './lib/supabase';
import { enEscritorio } from './lib/tauri';
import { Acceso } from './vistas/Acceso';
import { Ajustes } from './vistas/Ajustes';
import { Apartados } from './vistas/Apartados';
import { Bienvenida } from './vistas/Bienvenida';
import { Movimientos } from './vistas/Movimientos';
import { Resumen } from './vistas/Resumen';
import { Revisar } from './vistas/Revisar';

const TITULOS: Record<Ruta['vista'], string> = {
  resumen: 'RESUMEN',
  movimientos: 'MOVIMIENTOS',
  apartados: 'APARTADOS',
  revisar: 'POR REVISAR',
  ajustes: 'AJUSTES',
};

export function App() {
  return (
    <DatosProvider db={supabase} urlSupabase={URL_SUPABASE}>
      <AvisosProvider>
        <Puerta />
      </AvisosProvider>
    </DatosProvider>
  );
}

/** Decide qué mostrar: cargando, acceso, bienvenida o la app. */
function Puerta() {
  const { iniciado, sesion, listo, configurado, error } = useDatos();
  if (!iniciado || (sesion && !listo)) return <Cargando />;
  if (!sesion) return <Marco><Acceso /></Marco>;
  if (error && !configurado) return <Marco><ErrorCarga mensaje={error} /></Marco>;
  if (!configurado) return <Marco><Bienvenida /></Marco>;
  return <Principal />;
}

function Marco({ children }: { children: React.ReactNode }) {
  const ruta = useRuta();
  if (!enEscritorio) return <>{children}</>;
  return (
    <div className="ventana">
      <BarraTitulo ruta={ruta} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
    </div>
  );
}

function Principal() {
  const ruta = useRuta();
  const { porRevisar, cargando } = useDatos();
  const [nuevo, setNuevo] = useState(false);
  const ahora = partes(new Date());

  // Ctrl N: registrar gasto desde cualquier parte.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setNuevo(true);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  // Cada sección empieza arriba (en escritorio el que se desplaza es <main>).
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('.principal')?.scrollTo(0, 0);
  }, [ruta.vista]);

  useEffect(() => {
    document.title = `${TITULOS[ruta.vista].charAt(0)}${TITULOS[ruta.vista].slice(1).toLowerCase()} · Finanzas`;
  }, [ruta.vista]);

  const eyebrow =
    ruta.vista === 'revisar'
      ? `${porRevisar.length} ${porRevisar.length === 1 ? 'notificación' : 'notificaciones'}`
      : `${nombreDia(ahora.diaSemana, true)} ${ahora.dia} de ${nombreMes(ahora.mes, true)} · ${ahora.anio}`;

  const contenido = (
    <div className="shell fondo-app">
      <Sidebar ruta={ruta} />
      <main className="principal">
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {eyebrow}
              {cargando && <span className="pulse" aria-label="Actualizando" />}
            </span>
            <h1 key={ruta.vista} className="titulo-vista metal viewin">{TITULOS[ruta.vista]}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {enDemo && (
              <button className="chip acc" onClick={salirDemo} title="Salir de la demostración" style={{ height: 32 }}>
                Demostración · datos de ejemplo · Salir
              </button>
            )}
            <button className="btn sq" aria-label={`Por revisar: ${porRevisar.length}`} onClick={() => navegar('revisar')} style={{ position: 'relative' }}>
              <IcCampana />
              {porRevisar.length > 0 && <span style={{ position: 'absolute', top: 10, right: 11, width: 7, height: 7, borderRadius: '50%', background: '#B7ADFF', boxShadow: '0 0 0 2px #0E0F12' }} />}
            </button>
            <button className="btn pri" onClick={() => setNuevo(true)}>
              <IcMas tamano={16} />
              Registrar gasto
              <span className="kbd">Ctrl N</span>
            </button>
          </div>
        </header>
        <div key={ruta.vista} style={{ display: 'contents' }}>
          {ruta.vista === 'resumen' && <Resumen />}
          {ruta.vista === 'movimientos' && <Movimientos ruta={ruta} />}
          {ruta.vista === 'apartados' && <Apartados ruta={ruta} />}
          {ruta.vista === 'revisar' && <Revisar />}
          {ruta.vista === 'ajustes' && <Ajustes ruta={ruta} />}
        </div>
      </main>
      <NuevoGasto abierto={nuevo} onCerrar={() => setNuevo(false)} />
    </div>
  );

  if (!enEscritorio) return contenido;
  return (
    <div className="ventana">
      <BarraTitulo ruta={ruta} />
      {contenido}
    </div>
  );
}

function Cargando() {
  return (
    <div className="acceso">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <span className="logo" style={{ width: 56, height: 56, fontSize: 28, borderRadius: 18 }}>F</span>
        <span className="pulse" />
      </div>
    </div>
  );
}

function ErrorCarga({ mensaje }: { mensaje: string }) {
  const { recargar } = useDatos();
  return (
    <div className="acceso">
      <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
        <span style={{ fontWeight: 600, fontSize: 17 }}>No pudimos cargar tus datos</span>
        <span className="tenue" style={{ fontSize: 14 }}>{mensaje}</span>
        <button className="btn pri" onClick={() => void recargar()}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
