// En web/escritorio no hay lector: todo responde "no disponible".
import { NativeModule, registerWebModule } from 'expo';
import type { CapturaLocal, EstadoLector, EventosLector } from './tipos';

class LectorNotificacionesModule extends NativeModule<EventosLector> {
  tienePermiso() {
    return false;
  }
  abrirPermiso() {
    return false;
  }
  sinRestriccionBateria() {
    return false;
  }
  pedirSinRestriccionBateria() {
    return false;
  }
  abrirAjustesApp() {
    return false;
  }
  puedeAvisar() {
    return false;
  }
  pedirPermisoAvisos() {
    return false;
  }
  configurar(_url: string, _llave: string) {}
  llave(): string | null {
    return null;
  }
  olvidar() {}
  enviarAhora() {}
  estado(): EstadoLector {
    return {
      permiso: false,
      sinRestriccionBateria: false,
      puedeAvisar: false,
      configurado: false,
      pendientes: 0,
      enviadas: 0,
      ultimaCaptura: null,
      ultimoEnvio: null,
      ultimoError: null,
      puedeLeerProtegidas: true,
      ocultas: 0,
      ultimaOculta: null,
      paquete: 'web',
      fabricante: 'web',
      modelo: 'web',
      android: 0,
    };
  }
  recientes(_limite: number): CapturaLocal[] {
    return [];
  }
  avisoDePrueba(_titulo: string, _texto: string) {}
}

export default registerWebModule(LectorNotificacionesModule, 'LectorNotificacionesModule');
