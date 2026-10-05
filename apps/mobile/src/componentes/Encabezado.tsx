import type { ReactNode } from 'react';
import { View } from 'react-native';
import { T, TextoMetal, Entrada, Presionable } from './base';
import { color } from '../lib/tema';

export function Encabezado({ eyebrow, titulo, derecha }: { eyebrow: string; titulo: string; derecha?: ReactNode }) {
  return (
    <Entrada style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
      <View style={{ gap: 8, flexShrink: 1 }}>
        <T v="eyebrow">{eyebrow}</T>
        <TextoMetal tamano={42}>{titulo}</TextoMetal>
      </View>
      {derecha ? <View style={{ flexDirection: 'row', gap: 8 }}>{derecha}</View> : null}
    </Entrada>
  );
}

/** Botón redondo con ícono (y punto de aviso opcional). */
export function BotonIcono({ children, onPress, etiqueta, punto, activo }: { children: ReactNode; onPress: () => void; etiqueta: string; punto?: number; activo?: boolean }) {
  return (
    <Presionable
      onPress={onPress}
      escala={0.88}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: activo ? color.acentoBorde : color.borde,
        backgroundColor: activo ? 'rgba(154,141,242,0.16)' : 'rgba(255,255,255,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
      {punto ? (
        <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: color.acento, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0E0F12' }}>
          <T style={{ fontSize: 9, color: '#0A0B0D', fontFamily: 'Geist_600SemiBold' }}>{punto > 9 ? '9+' : punto}</T>
        </View>
      ) : null}
    </Presionable>
  );
}
