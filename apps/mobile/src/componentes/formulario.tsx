import { useState } from 'react';
import { Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { color, fuente } from '../lib/tema';
import { Presionable, T } from './base';

export function Campo({
  etiqueta,
  ayuda,
  style,
  ...props
}: TextInputProps & { etiqueta?: string; ayuda?: string; style?: StyleProp<ViewStyle> }) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={[{ gap: 8 }, style]}>
      {etiqueta ? <T v="eyebrow">{etiqueta}</T> : null}
      <TextInput
        placeholderTextColor={color.tenue}
        selectionColor={color.acento}
        {...props}
        onFocus={(e) => {
          setFoco(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          props.onBlur?.(e);
        }}
        style={{
          minHeight: 50,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: foco ? 'rgba(183,173,255,0.5)' : color.borde,
          backgroundColor: 'rgba(255,255,255,0.03)',
          color: color.texto,
          fontFamily: fuente.regular,
          fontSize: 15,
        }}
      />
      {ayuda ? <T v="pequeno">{ayuda}</T> : null}
    </View>
  );
}

/** Campo de dinero: muestra "$" y acepta "1,234.50". */
export function CampoDinero({ etiqueta, valor, onCambio, placeholder = '0', grande = false }: { etiqueta?: string; valor: string; onCambio: (v: string) => void; placeholder?: string; grande?: boolean }) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      {etiqueta ? <T v="eyebrow">{etiqueta}</T> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: grande ? 76 : 52,
          paddingHorizontal: grande ? 18 : 14,
          borderRadius: grande ? 18 : 14,
          borderWidth: 1,
          borderColor: foco ? 'rgba(183,173,255,0.5)' : color.borde,
          backgroundColor: 'rgba(255,255,255,0.03)',
        }}
      >
        <Text style={{ fontFamily: grande ? fuente.display : fuente.medio, fontSize: grande ? 40 : 16, color: '#6F737D' }}>$</Text>
        <TextInput
          value={valor}
          onChangeText={(t) => onCambio(t.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor="#4B4E57"
          selectionColor={color.acento}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          style={{ flex: 1, color: color.blanco, fontFamily: grande ? fuente.display : fuente.medio, fontSize: grande ? 40 : 16, padding: 0 }}
        />
      </View>
    </View>
  );
}

/** − 30 % + : para ajustar porcentajes de 5 en 5. */
export function Pasos({ valor, onCambio, minimo = 0, maximo = 100, paso = 5, sufijo = '%' }: { valor: number; onCambio: (v: number) => void; minimo?: number; maximo?: number; paso?: number; sufijo?: string }) {
  const boton = (texto: string, delta: number) => (
    <Presionable
      onPress={() => onCambio(Math.max(minimo, Math.min(maximo, valor + delta)))}
      escala={0.88}
      accessibilityRole="button"
      accessibilityLabel={delta > 0 ? 'Aumentar' : 'Disminuir'}
      style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: color.borde, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: color.texto, fontFamily: fuente.semi, fontSize: 20 }}>{texto}</Text>
    </Presionable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {boton('−', -paso)}
      <Text style={{ minWidth: 56, textAlign: 'center', color: color.blanco, fontFamily: fuente.semi, fontSize: 16 }}>
        {valor}
        {sufijo}
      </Text>
      {boton('+', paso)}
    </View>
  );
}
