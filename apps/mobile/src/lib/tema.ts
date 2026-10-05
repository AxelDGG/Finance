// Mismo sistema visual que el diseño aprobado: fondo casi negro, plata y un solo acento violeta.
import { Easing } from 'react-native-reanimated';

/**
 * Movimiento sin rebote: `deslizar` para selectores y marcadores, `suave` para
 * aparecer y soltar botones. El resorte queda solo en la barra de pestañas y
 * en las entradas de pantalla.
 */
export const deslizar = { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) };
export const suave = { duration: 260, easing: Easing.out(Easing.cubic) };

export const color = {
  fondo: '#08090B',
  fondoElevado: '#111216',
  hoja: '#131418',
  texto: '#EDEEF0',
  blanco: '#FFFFFF',
  texto2: '#A2A5AD',
  texto3: '#8E919A',
  tenue: '#80838C',
  borde: 'rgba(255,255,255,0.08)',
  bordeFuerte: 'rgba(255,255,255,0.14)',
  vidrio: 'rgba(255,255,255,0.045)',
  vidrio2: 'rgba(255,255,255,0.018)',
  pista: 'rgba(255,255,255,0.07)',
  acento: '#9A8DF2',
  acentoClaro: '#C9C2FF',
  acentoTexto: '#D4CEFF',
  acentoSuave: 'rgba(154,141,242,0.14)',
  acentoBorde: 'rgba(183,173,255,0.32)',
  plata: '#E2E3E7',
  gris: '#A7AAB2',
  ahorro: '#5E58A0',
  ingreso: '#CFC8FF',
  peligro: '#F2A7A7',
} as const;

export const fuente = {
  display: 'Anton_400Regular',
  regular: 'Geist_400Regular',
  medio: 'Geist_500Medium',
  semi: 'Geist_600SemiBold',
  mono: 'GeistMono_500Medium',
} as const;

/** Colores de apartados/categorías distinguibles por luminosidad (no solo por tono). */
export const paleta = ['#9A8DF2', '#E2E3E7', '#A7AAB2', '#6F737D', '#5E58A0', '#C9C1FF', '#4B4E57', '#34363D'];

export const radio = { tarjeta: 22, boton: 14, pastilla: 99 } as const;
