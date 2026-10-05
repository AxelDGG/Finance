import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Hoja que sube desde abajo, con fondo que se oscurece. */
export function HojaInferior({ visible, onCerrar, children }: { visible: boolean; onCerrar: () => void; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [montada, setMontada] = useState(visible);
  const y = useSharedValue(height);
  const fondo = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMontada(true);
      y.value = height;
      y.value = withSpring(0, { damping: 22, stiffness: 190, mass: 0.9 });
      fondo.value = withTiming(1, { duration: 300 });
    } else if (montada) {
      Keyboard.dismiss();
      fondo.value = withTiming(0, { duration: 260 });
      y.value = withTiming(height, { duration: 320, easing: Easing.in(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(setMontada)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const estiloHoja = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const estiloFondo = useAnimatedStyle(() => ({ opacity: fondo.value }));

  if (!montada) return null;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={onCerrar} animationType="none">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.62)' }, estiloFondo]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityLabel="Cerrar" />
        </Animated.View>
        <Animated.View style={[estilos.hoja, { maxHeight: height * 0.9, paddingBottom: insets.bottom + 20 }, estiloHoja]}>
          <LinearGradient colors={['#17181D', '#101114']} style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 28, borderTopRightRadius: 28 }]} />
          <View style={estilos.asa} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  hoja: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
    overflow: 'hidden',
  },
  asa: { width: 40, height: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 16 },
});
