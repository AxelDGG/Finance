import { traducirError, useDatos } from '@finanzas/api';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Boton, T, TextoMetal } from '../componentes/base';
import { Campo } from '../componentes/formulario';
import { supabase } from '../lib/supabase';
import { color } from '../lib/tema';

export default function Login() {
  const { sesion } = useDatos();
  const insets = useSafeAreaInsets();
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  if (sesion) return <Redirect href="/" />;

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
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <LinearGradient colors={['rgba(154,141,242,0.16)', 'transparent']} style={[StyleSheet.absoluteFill, { height: 420 }]} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeIn.duration(800)} style={{ marginBottom: 36, gap: 10 }}>
            <T v="eyebrow">Control personal</T>
            <TextoMetal tamano={64}>FINANZAS</TextoMetal>
            <T v="tenue" style={{ fontSize: 15, lineHeight: 22, maxWidth: 320 }}>
              Tus gastos de BBVA, Santander y Google Wallet, ordenados solos. Tus apartados y metas, al día.
            </T>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).springify().damping(18)} style={{ gap: 16 }}>
            <Campo etiqueta="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="tu@correo.com" />
            <Campo
              etiqueta="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              placeholder="Mínimo 6 caracteres"
              onSubmitEditing={() => void enviar()}
            />
            {mensaje && (
              <Animated.View entering={FadeInDown.springify()} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: mensaje.error ? 'rgba(242,167,167,0.35)' : color.acentoBorde, backgroundColor: mensaje.error ? 'rgba(242,167,167,0.08)' : 'rgba(154,141,242,0.08)' }}>
                <T style={{ color: mensaje.error ? color.peligro : color.acentoTexto, lineHeight: 19 }}>{mensaje.texto}</T>
              </Animated.View>
            )}
            <Boton titulo={modo === 'entrar' ? 'Entrar' : 'Crear cuenta'} onPress={() => void enviar()} cargando={cargando} style={{ marginTop: 6, minHeight: 54 }} />
            <Pressable onPress={() => setModo(modo === 'entrar' ? 'crear' : 'entrar')} style={{ alignItems: 'center', paddingVertical: 12 }} accessibilityRole="button">
              <T v="tenue">
                {modo === 'entrar' ? '¿Primera vez? ' : '¿Ya tienes cuenta? '}
                <T style={{ color: color.acentoClaro }}>{modo === 'entrar' ? 'Crea tu cuenta' : 'Entra'}</T>
              </T>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
