import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { enEscritorio } from './lib/tauri';
import './estilos.css';

// En el navegador la app se instala y funciona sin conexión; en Tauri no hace falta.
if (!enEscritorio && import.meta.env.PROD) registerSW({ immediate: true });

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
