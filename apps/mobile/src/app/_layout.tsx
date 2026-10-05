import { Anton_400Regular } from '@expo-google-fonts/anton';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { DatosProvider, useDatos } from '@finanzas/api';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Lector, lectorDisponible, olvidarTelefono, vincularTelefono } from '../lib/lector';
import { supabase, URL_SUPABASE } from '../lib/supabase';
import { color } from '../lib/tema';

void SplashScreen.preventAutoHideAsync();

export default function Raiz() {
  const [fuentesListas] = useFonts({ Anton_400Regular, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, GeistMono_500Medium });

  useEffect(() => {
    if (fuentesListas) void SplashScreen.hideAsync();
  }, [fuentesListas]);

  if (!fuentesListas) return null;
  return (
    <SafeAreaProvider>
      <DatosProvider db={supabase} urlSupabase={URL_SUPABASE}>
        <StatusBar style="light" />
        <EnlaceTelefono />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.fondo },
            animation: 'fade_from_bottom',
          }}
        />
      </DatosProvider>
    </SafeAreaProvider>
  );
}

/**
 * Al iniciar sesión vincula el teléfono (llave para el lector nativo);
 * al cerrarla, la olvida. También refresca los datos cuando el lector envía.
 */
function EnlaceTelefono() {
  const { sesion, listo, acciones, recargar } = useDatos();
  const intentando = useRef(false);
  const habiaSesion = useRef(false);

  useEffect(() => {
    if (!lectorDisponible) return;
    if (sesion) habiaSesion.current = true;
    if (!sesion && habiaSesion.current) {
      olvidarTelefono();
      habiaSesion.current = false;
      return;
    }
    if (!sesion || !listo || intentando.current) return;
    if (Lector.estado().configurado) return;
    intentando.current = true;
    vincularTelefono(acciones.registrarDispositivo)
      .catch(() => undefined)
      .finally(() => {
        intentando.current = false;
      });
  }, [sesion, listo, acciones]);

  useEffect(() => {
    if (!lectorDisponible) return;
    const sub = Lector.addListener('onEnvio', (e) => {
      if (e.ok) void recargar(['movimientos', 'porMover', 'porRevisar']);
    });
    return () => sub.remove();
  }, [recargar]);

  return null;
}
