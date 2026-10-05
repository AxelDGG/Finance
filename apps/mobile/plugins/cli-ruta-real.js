// Hace que Gradle empaquete el JavaScript con scripts/expo-ruta-real.js
// (ver la explicación en ese archivo). Vive como plugin para que
// `expo prebuild` no borre el cambio.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function cliRutaReal(config) {
  return withAppBuildGradle(config, (c) => {
    const gradle = c.modResults.contents;
    if (gradle.includes('expo-ruta-real.js')) return c;
    const linea = /^(\s*)cliFile = .*$/m;
    if (!linea.test(gradle)) throw new Error('cli-ruta-real: no encontré cliFile en build.gradle');
    c.modResults.contents = gradle.replace(linea, (_m, sangria) => `${sangria}cliFile = new File(projectDir, "../../scripts/expo-ruta-real.js")`);
    return c;
  });
};
