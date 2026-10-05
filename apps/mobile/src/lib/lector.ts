import { Platform } from 'react-native';
import Lector, { type EstadoLector } from '../../modules/lector-notificaciones';
import { URL_SUPABASE } from './supabase';

export const lectorDisponible = Platform.OS === 'android';

export function estadoLector(): EstadoLector {
  return Lector.estado();
}

/**
 * Vincula este teléfono con tu cuenta: crea una llave de dispositivo en
 * Supabase y se la da al lector nativo para que envíe las capturas.
 */
export async function vincularTelefono(registrar: (nombre: string) => Promise<string>): Promise<void> {
  if (!lectorDisponible) return;
  const estado = Lector.estado();
  const nombre = `${estado.fabricante} ${estado.modelo}`.trim() || 'Teléfono';
  const llave = await registrar(nombre);
  Lector.configurar(URL_SUPABASE, llave);
}

export function olvidarTelefono() {
  if (lectorDisponible) Lector.olvidar();
}

export { Lector };
