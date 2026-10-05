import { useEffect, useRef, useState } from 'react';

/** Anima un número desde su valor anterior (o 0) hasta el nuevo. */
export function useContador(valor: number, duracion = 1100): number {
  const [mostrado, setMostrado] = useState(0);
  const anterior = useRef(0);

  useEffect(() => {
    const desde = anterior.current;
    const inicio = Date.now();
    let marco = 0;
    const paso = () => {
      const p = Math.min(1, (Date.now() - inicio) / duracion);
      const e = 1 - Math.pow(1 - p, 3);
      const v = desde + (valor - desde) * e;
      setMostrado(v);
      if (p < 1) marco = requestAnimationFrame(paso);
      else anterior.current = valor;
    };
    marco = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(marco);
      anterior.current = valor;
    };
  }, [valor, duracion]);

  return mostrado;
}
