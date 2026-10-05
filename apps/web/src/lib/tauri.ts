// Detecta si corremos dentro de la app de escritorio (Tauri) y controla la ventana.
export const enEscritorio = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function ventana() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

export const minimizar = async () => (await ventana()).minimize();
export const alternarMaximizar = async () => (await ventana()).toggleMaximize();
export const cerrarVentana = async () => (await ventana()).close();
export const arrastrarVentana = async () => (await ventana()).startDragging();

/** Guarda un archivo: en escritorio con el diálogo de la ventana, en web como descarga. */
export function descargar(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
