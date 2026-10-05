import { NativeModule, requireNativeModule } from 'expo';
import type { CapturaLocal, EstadoLector, EventosLector } from './tipos';

declare class LectorNotificacionesModule extends NativeModule<EventosLector> {
  tienePermiso(): boolean;
  abrirPermiso(): boolean;
  sinRestriccionBateria(): boolean;
  pedirSinRestriccionBateria(): boolean;
  abrirAjustesApp(): boolean;
  puedeAvisar(): boolean;
  pedirPermisoAvisos(): boolean;
  configurar(url: string, llave: string): void;
  olvidar(): void;
  enviarAhora(): void;
  estado(): EstadoLector;
  recientes(limite: number): CapturaLocal[];
  avisoDePrueba(titulo: string, texto: string): void;
}

export default requireNativeModule<LectorNotificacionesModule>('LectorNotificaciones');
