import { useEffect, useState } from 'react';

export type Vista = 'resumen' | 'movimientos' | 'apartados' | 'revisar' | 'ajustes';
const VISTAS: Vista[] = ['resumen', 'movimientos', 'apartados', 'revisar', 'ajustes'];

export interface Ruta {
  vista: Vista;
  params: URLSearchParams;
}

function leer(): Ruta {
  const [camino = '', consulta = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const vista = (VISTAS as string[]).includes(camino) ? (camino as Vista) : 'resumen';
  return { vista, params: new URLSearchParams(consulta) };
}

/** Rutas con "#/vista?param=x" para que funcionen igual en web, PWA y Tauri. */
export function useRuta(): Ruta {
  const [ruta, setRuta] = useState(leer);
  useEffect(() => {
    const cambio = () => setRuta(leer());
    window.addEventListener('hashchange', cambio);
    return () => window.removeEventListener('hashchange', cambio);
  }, []);
  return ruta;
}

/** `reemplazar` no agrega una entrada al historial (p. ej. al escribir en el buscador). */
export function navegar(vista: Vista, params?: Record<string, string | null | undefined>, reemplazar = false) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) p.set(k, v);
  const q = p.toString();
  const hash = `#/${vista}${q ? `?${q}` : ''}`;
  if (hash === window.location.hash) return;
  if (reemplazar) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else window.location.hash = hash;
}
