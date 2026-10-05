import { useId } from 'react';

/** El logo: F de plata con su barra de progreso violeta (mismas medidas que scripts/generar-iconos.py). */
export function Logo({ tamano = 40, className = 'logo' }: { tamano?: number; className?: string }) {
  const id = useId().replace(/[^\w-]/g, '');
  const url = (nombre: string) => `url(#${nombre}${id})`;
  return (
    <svg className={className} width={tamano} height={tamano} viewBox="40 40 944 944" aria-hidden="true">
      <defs>
        <linearGradient id={`azulejo${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1d23" />
          <stop offset="1" stopColor="#09090b" />
        </linearGradient>
        <radialGradient id={`brillo${id}`} cx="0.8" cy="0.08" r="0.8">
          <stop offset="0" stopColor="#9a8df2" stopOpacity="0.42" />
          <stop offset="0.55" stopColor="#9a8df2" stopOpacity="0.06" />
          <stop offset="1" stopColor="#9a8df2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`metal${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="232" x2="0" y2="792">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#e2e3e7" />
          <stop offset="1" stopColor="#8f939c" />
        </linearGradient>
        <linearGradient id={`barra${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a6ce0" />
          <stop offset="1" stopColor="#d4ceff" />
        </linearGradient>
        <filter id={`difuso${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>
      <rect x="40" y="40" width="944" height="944" rx="216" fill={url('azulejo')} />
      <rect x="40" y="40" width="944" height="944" rx="216" fill={url('brillo')} />
      <rect x="356" y="452" width="384" height="124" rx="62" fill="#fff" fillOpacity="0.09" />
      <rect x="356" y="470" width="270" height="96" rx="48" fill="#9a8df2" opacity="0.7" filter={url('difuso')} />
      <rect x="356" y="452" width="290" height="124" rx="62" fill={url('barra')} />
      <path d="M356 232H678A62 62 0 0 1 678 356H440Q418 356 418 378V730A62 62 0 0 1 294 730V294A62 62 0 0 1 356 232Z" fill={url('metal')} />
    </svg>
  );
}
