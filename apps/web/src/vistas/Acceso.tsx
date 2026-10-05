import { traducirError } from '@finanzas/api';
import { useState } from 'react';
import { Campo } from '../componentes/ui';
import { IcFlecha } from '../componentes/iconos';
import { entrarDemo } from '../lib/demo';
import { supabase } from '../lib/supabase';

export function Acceso() {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  const enviar = async () => {
    setMensaje(null);
    if (!email.includes('@') || password.length < 6) {
      setMensaje({ texto: 'Escribe tu correo y una contraseña de al menos 6 caracteres.', error: true });
      return;
    }
    setCargando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          setMensaje({ texto: 'Listo. Te mandamos un correo para confirmar tu cuenta; ábrelo y luego entra aquí.', error: false });
          setModo('entrar');
        }
      }
    } catch (e) {
      setMensaje({ texto: traducirError(e instanceof Error ? e.message : String(e)), error: true });
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="acceso">
      <form
        className="caja"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <div className="viewin" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <span className="eyebrow">Control personal</span>
          <h1 className="metal display" style={{ margin: 0, fontSize: 'clamp(64px, 10vw, 96px)' }}>FINANZAS</h1>
          <p className="tenue" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 360 }}>
            Tus gastos de BBVA, Santander y Google Wallet, ordenados solos. Tus apartados y metas, al día.
          </p>
        </div>
        <div className="card rise" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, animationDelay: '120ms' }}>
          <Campo etiqueta="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tu@correo.com" autoFocus />
          <Campo
            etiqueta="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            placeholder="Mínimo 6 caracteres"
          />
          {mensaje && (
            <div
              key={mensaje.texto}
              className="rise"
              role={mensaje.error ? 'alert' : 'status'}
              style={{
                padding: 12,
                borderRadius: 12,
                fontSize: 13.5,
                lineHeight: 1.45,
                border: `1px solid ${mensaje.error ? 'rgba(242,167,167,0.35)' : 'rgba(183,173,255,0.32)'}`,
                background: mensaje.error ? 'rgba(242,167,167,0.08)' : 'rgba(154,141,242,0.08)',
                color: mensaje.error ? 'var(--peligro)' : 'var(--acento-texto)',
              }}
            >
              {mensaje.texto}
            </div>
          )}
          <button type="submit" className="btn pri" disabled={cargando} style={{ minHeight: 52, marginTop: 4 }}>
            {cargando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
            <IcFlecha className="go" tamano={16} />
          </button>
        </div>
        <button type="button" className="btn" style={{ background: 'transparent', borderColor: 'transparent' }} onClick={() => setModo(modo === 'entrar' ? 'crear' : 'entrar')}>
          <span className="tenue">{modo === 'entrar' ? '¿Primera vez?' : '¿Ya tienes cuenta?'}</span>
          <span style={{ color: 'var(--acento-claro)' }}>{modo === 'entrar' ? 'Crea tu cuenta' : 'Entra'}</span>
        </button>
        <button type="button" className="btn sm" style={{ alignSelf: 'center' }} onClick={entrarDemo}>
          Ver demostración con datos de ejemplo
        </button>
      </form>
    </main>
  );
}
