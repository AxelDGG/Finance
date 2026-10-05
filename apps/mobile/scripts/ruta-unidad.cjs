// Se precarga (NODE_OPTIONS=--require) en los procesos de Node que lanza Gradle
// al compilar el APK desde la unidad corta W: (ver scripts/compilar-apk.mjs).
//
// En Windows, fs.realpath "nativo" convierte W:\... en la ruta real C:\..., y el
// autolinking de Expo lo usa: Gradle terminaría mezclando proyectos en W: y en C:
// ("different roots") y con rutas de más de 260 caracteres. Aquí se traduce la
// ruta real de regreso a la unidad corta. Sin las variables, no hace nada.
const fs = require('node:fs');
const path = require('node:path');

const unidad = process.env.FINANZAS_UNIDAD_RAIZ;
const real = process.env.FINANZAS_RUTA_REAL;

if (unidad && real) {
  const prefijo = real.toLowerCase();
  const traducir = (p) => (typeof p === 'string' && p.toLowerCase().startsWith(prefijo) ? path.join(unidad, p.slice(real.length)) : p);

  const promesa = fs.promises.realpath.bind(fs.promises);
  fs.promises.realpath = async (...args) => traducir(await promesa(...args));

  const nativoSync = fs.realpathSync.native;
  fs.realpathSync.native = (...args) => traducir(nativoSync(...args));

  const nativo = fs.realpath.native;
  fs.realpath.native = (p, opciones, cb) => {
    const callback = typeof opciones === 'function' ? opciones : cb;
    const resto = typeof opciones === 'function' ? [] : [opciones];
    nativo(p, ...resto, (error, resultado) => callback(error, error ? resultado : traducir(resultado)));
  };
}
