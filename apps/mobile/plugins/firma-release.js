// Firma las compilaciones "release" con la llave propia de credenciales/firma.properties
// (si no existe, se usa la de depuración como en la plantilla de Expo).
// Vive como plugin para que `expo prebuild` no borre la configuración.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARCA = '// firma-release';

const BLOQUE_FIRMA = `
        release { ${MARCA}
            def firma = rootProject.file('../credenciales/firma.properties')
            if (firma.exists()) {
                def p = new Properties()
                firma.withInputStream { p.load(it) }
                storeFile rootProject.file("../credenciales/\${p['archivo']}")
                storePassword p['clave']
                keyAlias p['alias']
                keyPassword p['clave']
            }
        }`;

module.exports = function firmaRelease(config) {
  return withAppBuildGradle(config, (c) => {
    let gradle = c.modResults.contents;
    if (gradle.includes(MARCA)) return c;

    // 1) En buildTypes.release, usar la firma propia cuando exista.
    const inicioTipos = gradle.indexOf('buildTypes {');
    const inicioRelease = gradle.indexOf('release {', inicioTipos);
    const linea = 'signingConfig signingConfigs.debug';
    const posicion = gradle.indexOf(linea, inicioRelease);
    if (inicioTipos < 0 || inicioRelease < 0 || posicion < 0) throw new Error('firma-release: no encontré buildTypes.release en build.gradle');
    gradle =
      gradle.slice(0, posicion) +
      "signingConfig rootProject.file('../credenciales/firma.properties').exists() ? signingConfigs.release : signingConfigs.debug" +
      gradle.slice(posicion + linea.length);

    // 2) Declarar signingConfigs.release.
    gradle = gradle.replace(/signingConfigs \{/, (m) => m + BLOQUE_FIRMA);
    c.modResults.contents = gradle;
    return c;
  });
};
