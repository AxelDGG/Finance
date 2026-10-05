import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { color } from '../lib/tema';
import { T } from './base';

interface AvisoActual {
  id: number;
  titulo: string;
  texto: string;
}

const Contexto = createContext<(titulo: string, texto: string) => void>(() => undefined);

/** Aviso flotante arriba de la pantalla ("Gasto registrado…"). */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<AvisoActual | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const mostrar = useCallback((titulo: string, texto: string) => {
    clearTimeout(temporizador.current);
    setAviso({ id: Date.now(), titulo, texto });
    temporizador.current = setTimeout(() => setAviso(null), 2800);
  }, []);

  return (
    <Contexto.Provider value={mostrar}>
      {children}
      {aviso && (
        <Animated.View
          key={aviso.id}
          entering={FadeInUp.springify().damping(15)}
          exiting={FadeOutUp.duration(250)}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: insets.top + 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: 18,
            backgroundColor: 'rgba(24,25,30,0.97)',
            borderWidth: 1,
            borderColor: color.acentoBorde,
          }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#0A0B0D" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M5 12.5l4.5 4.5L19 7.5" />
            </Svg>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <T v="semi" style={{ fontSize: 14 }}>{aviso.titulo}</T>
            <T v="tenue" style={{ fontSize: 12.5 }}>{aviso.texto}</T>
          </View>
        </Animated.View>
      )}
    </Contexto.Provider>
  );
}

export const useAviso = () => useContext(Contexto);
