// Compila el APK release firmado (arm64) para instalarlo en el teléfono:
//   pnpm apk          (o: node scripts/compilar-apk.mjs)
//
// - Lo nativo se compila desde la unidad corta W: (subst) porque las rutas de
//   CMake/ninja pasan de 260 caracteres en Windows.
// - El JavaScript lo empaqueta apps/mobile/scripts/expo-ruta-real.js desde la
//   ruta real, donde Metro resuelve los paquetes del monorepo.
// - Se usa el JDK 21 de Android Studio (con Java 24 falla la configuración de CMake).
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const UNIDAD = process.env.FINANZAS_UNIDAD ?? 'W:';
const JAVA_HOME = process.env.FINANZAS_JAVA_HOME ?? 'C:\\Program Files\\Android\\Android Studio\\jbr';

const raiz = realpathSync.native(join(import.meta.dirname, '..'));
const androidEnUnidad = `${UNIDAD}\\apps\\mobile\\android`;

if (!existsSync(join(androidEnUnidad, 'gradlew.bat'))) {
  console.error(`No encuentro ${androidEnUnidad}. Crea la unidad corta y vuelve a intentar:\n  subst ${UNIDAD} ${raiz}`);
  process.exit(1);
}
if (!existsSync(join(JAVA_HOME, 'bin', 'java.exe'))) {
  console.error(`No encuentro el JDK de Android Studio en ${JAVA_HOME} (define FINANZAS_JAVA_HOME).`);
  process.exit(1);
}

// La caché de autolinking guarda rutas absolutas; si se generó desde C:\ choca con
// las de W:\ ("different roots"). Se regenera en cada compilación.
rmSync(join(androidEnUnidad, 'build', 'generated', 'autolinking'), { recursive: true, force: true });

const argumentos = ['assembleRelease', '-PreactNativeArchitectures=arm64-v8a', '-Pkotlin.incremental=false', '--console=plain'];
console.log(`> ${androidEnUnidad}\\gradlew.bat ${argumentos.join(' ')}`);
execFileSync('cmd', ['/c', join(androidEnUnidad, 'gradlew.bat'), ...argumentos], { cwd: androidEnUnidad, stdio: 'inherit', env: { ...process.env, JAVA_HOME, PWD: androidEnUnidad } });

const apk = join(raiz, 'apps', 'mobile', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
console.log(`\nListo: ${apk} (${(statSync(apk).size / 1048576).toFixed(1)} MB)`);
