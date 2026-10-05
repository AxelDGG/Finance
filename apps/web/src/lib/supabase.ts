import { createClient } from '@supabase/supabase-js';
import { crearClienteDemo, enDemo } from './demo';

// La llave "publishable" es pública por diseño: la seguridad la da RLS.
export const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL ?? 'https://ccqpwdctuaxllfrbxghj.supabase.co';
const LLAVE_PUBLICA = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_0etpyg9bIlDwPoU37tapsg_uJhpxUTM';

export const supabase = enDemo
  ? crearClienteDemo()
  : createClient(URL_SUPABASE, LLAVE_PUBLICA, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, storageKey: 'finanzas-sesion' },
    });
