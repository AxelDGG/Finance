// Intermediario del CLI de Expo para Gradle (empaquetado del JavaScript).
//
// El APK se compila desde la unidad corta W: (subst) por el límite de 260
// caracteres de Windows, pero desde ahí Metro no resuelve los paquetes del
// monorepo (@finanzas/*), que son enlaces a la ruta real C:\... Este script
// traduce las rutas W:\ a la ruta real y ejecuta el CLI de Expo desde ahí.
// Si no se compila desde una unidad subst, no cambia nada.
const { realpathSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const proyecto = process.cwd();
const raiz = process.env.FINANZAS_UNIDAD_RAIZ ?? path.parse(proyecto).root;
// Con la precarga de ruta-unidad.cjs activa, realpath ya no devuelve la ruta
// real; por eso se usa la que deja scripts/compilar-apk.mjs.
const raizReal = process.env.FINANZAS_RUTA_REAL ?? realpathSync.native(raiz);

const traducir = (arg) => (arg.toLowerCase().startsWith(raiz.toLowerCase()) ? path.join(raizReal, arg.slice(raiz.length)) : arg);
const proyectoReal = traducir(proyecto);
const argumentos = process.argv.slice(2).map(traducir);

// El CLI corre sin la precarga: Metro debe ver la ruta real.
const entorno = { ...process.env };
for (const clave of ['NODE_OPTIONS', 'FINANZAS_UNIDAD_RAIZ', 'FINANZAS_RUTA_REAL']) delete entorno[clave];
const expo = require.resolve('expo/package.json', { paths: [proyectoReal] });
const cli = require.resolve('@expo/cli', { paths: [expo] });
const r = spawnSync(process.execPath, [cli, ...argumentos], { cwd: proyectoReal, stdio: 'inherit', env: entorno });
process.exit(r.status ?? 1);
