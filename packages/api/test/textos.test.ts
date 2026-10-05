import { describe, expect, it } from 'vitest';
import { descripcionSobrante, prefijoSobrante, traducirError } from '../src/index.ts';

describe('textos', () => {
  it('el cierre de mes usa el nombre del mes y se reconoce por su prefijo', () => {
    const texto = descripcionSobrante('2026-09', 188126, 'Viaje');
    expect(texto).toBe('Sobrante de septiembre 2026: apartar $1,881.26 para Viaje');
    expect(texto.startsWith(prefijoSobrante('2026-09'))).toBe(true);
    expect(texto.startsWith(prefijoSobrante('2026-08'))).toBe(false);
  });

  it('traduce los errores comunes', () => {
    expect(traducirError('Invalid login credentials')).toBe('Correo o contraseña incorrectos.');
    expect(traducirError('TypeError: Failed to fetch')).toBe('Sin conexión. Revisa tu internet.');
    expect(traducirError('algo raro')).toBe('algo raro');
  });
});
