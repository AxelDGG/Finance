import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { tamano?: number; color?: string; grosor?: number };
const base = ({ tamano = 22, color = 'currentColor', grosor = 1.7 }: P) => ({
  width: tamano,
  height: tamano,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: grosor,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconoInicio = (p: P) => (
  <Svg {...base(p)}>
    <Path d="M3 10.5L12 3l9 7.5" />
    <Path d="M5 9.5V20h14V9.5" />
  </Svg>
);
export const IconoMovimientos = (p: P) => (
  <Svg {...base(p)}>
    <Path d="M7 20V4M7 4L3 8M7 4l4 4" />
    <Path d="M17 4v16M17 20l-4-4M17 20l4-4" />
  </Svg>
);
export const IconoApartados = (p: P) => (
  <Svg {...base(p)}>
    <Path d="M12 3l9 4.5-9 4.5-9-4.5z" />
    <Path d="M3 12l9 4.5 9-4.5" />
    <Path d="M3 16.5l9 4.5 9-4.5" />
  </Svg>
);
export const IconoMas = (p: P) => (
  <Svg {...base({ grosor: 2.4, ...p })}>
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconoCampana = (p: P) => (
  <Svg {...base(p)}>
    <Path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Svg>
);
export const IconoAjustes = (p: P) => (
  <Svg {...base(p)}>
    <Circle cx={12} cy={12} r={3} />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);
export const IconoBuscar = (p: P) => (
  <Svg {...base(p)}>
    <Circle cx={11} cy={11} r={7} />
    <Path d="M20 20l-3.5-3.5" />
  </Svg>
);
export const IconoCheck = (p: P) => (
  <Svg {...base({ grosor: 2.6, ...p })}>
    <Path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconoFlechas = (p: P) => (
  <Svg {...base(p)}>
    <Path d="M4 8h13M13 4l4 4-4 4" />
    <Path d="M20 16H7M11 12l-4 4 4 4" />
  </Svg>
);
export const IconoAtras = (p: P) => (
  <Svg {...base({ grosor: 2, ...p })}>
    <Path d="M15 6l-6 6 6 6" />
  </Svg>
);
export const IconoChevron = (p: P) => (
  <Svg {...base({ grosor: 2, ...p })}>
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconoDerecha = (p: P) => (
  <Svg {...base({ grosor: 2, ...p })}>
    <Path d="M9 6l6 6-6 6" />
  </Svg>
);
export const IconoAlerta = (p: P) => (
  <Svg {...base(p)}>
    <Path d="M12 9v4M12 17h.01" />
    <Path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </Svg>
);
export const IconoTarjeta = (p: P) => (
  <Svg {...base(p)}>
    <Rect x={3} y={5} width={18} height={14} rx={2} />
    <Path d="M3 10h18" />
  </Svg>
);
