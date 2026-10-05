import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// La llave "publishable" es pública por diseño: la seguridad la da RLS.
export const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ccqpwdctuaxllfrbxghj.supabase.co';
const LLAVE_PUBLICA = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_0etpyg9bIlDwPoU37tapsg_uJhpxUTM';

export const supabase = createClient(URL_SUPABASE, LLAVE_PUBLICA, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renovar la sesión solo mientras la app está en primer plano.
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
