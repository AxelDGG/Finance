import type { ReactNode, SVGProps } from 'react';

function Icono({ children, tamano = 18, grosor = 1.8, ...resto }: { children: ReactNode; tamano?: number; grosor?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...resto}>
      {children}
    </svg>
  );
}

type P = { tamano?: number; grosor?: number } & SVGProps<SVGSVGElement>;

export const IcResumen = (p: P) => (
  <Icono {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Icono>
);
export const IcMovimientos = (p: P) => (
  <Icono {...p}>
    <path d="M7 20V4M7 4L3 8M7 4l4 4" />
    <path d="M17 4v16M17 20l-4-4M17 20l4-4" />
  </Icono>
);
export const IcApartados = (p: P) => (
  <Icono {...p}>
    <path d="M12 3l9 4.5-9 4.5-9-4.5z" />
    <path d="M3 12l9 4.5 9-4.5" />
    <path d="M3 16.5l9 4.5 9-4.5" />
  </Icono>
);
export const IcCampana = (p: P) => (
  <Icono {...p}>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Icono>
);
export const IcAjustes = (p: P) => (
  <Icono {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icono>
);
export const IcMas = (p: P) => (
  <Icono grosor={2.2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icono>
);
export const IcFlecha = (p: P) => (
  <Icono grosor={2} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icono>
);
export const IcChevron = (p: P) => (
  <Icono grosor={2} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icono>
);
export const IcContraer = (p: P) => (
  <Icono {...p}>
    <path d="M11 17l-5-5 5-5" />
    <path d="M18 17l-5-5 5-5" />
  </Icono>
);
export const IcCerrar = (p: P) => (
  <Icono grosor={2} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icono>
);
export const IcBuscar = (p: P) => (
  <Icono grosor={2} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icono>
);
export const IcCheck = (p: P) => (
  <Icono grosor={3} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icono>
);
export const IcDescargar = (p: P) => (
  <Icono {...p}>
    <path d="M12 4v11M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </Icono>
);
export const IcSubir = (p: P) => (
  <Icono {...p}>
    <path d="M12 20V9M7 14l5-5 5 5" />
    <path d="M5 4h14" />
  </Icono>
);
export const IcAlerta = (p: P) => (
  <Icono {...p}>
    <path d="M12 3l9.5 17h-19z" />
    <path d="M12 10v4M12 17.5v.01" />
  </Icono>
);
export const IcSalir = (p: P) => (
  <Icono {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17l-5-5 5-5M5 12h11" />
  </Icono>
);
export const IcTelefono = (p: P) => (
  <Icono {...p}>
    <rect x="6" y="2.5" width="12" height="19" rx="3" />
    <path d="M11 18h2" />
  </Icono>
);
export const IcDestello = ({ tamano = 18, ...p }: P) => (
  <svg width={tamano} height={tamano} viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M12 2l1.8 8.2L22 12l-8.2 1.8L12 22l-1.8-8.2L2 12l8.2-1.8z" fill="currentColor" />
  </svg>
);
