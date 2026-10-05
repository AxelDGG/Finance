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
const proyectoReal = realpathSync.native(proyecto);
const raiz = path.parse(proyecto).root;
const raizReal = realpathSync.native(raiz);

const traducir = (arg) => (arg.toLowerCase().startsWith(raiz.toLowerCase()) ? path.join(raizReal, arg.slice(raiz.length)) : arg);
const argumentos = process.argv.slice(2).map(traducir);

const expo = require.resolve('expo/package.json', { paths: [proyectoReal] });
const cli = require.resolve('@expo/cli', { paths: [expo] });
const r = spawnSync(process.execPath, [cli, ...argumentos], { cwd: proyectoReal, stdio: 'inherit' });
process.exit(r.status ?? 1);
