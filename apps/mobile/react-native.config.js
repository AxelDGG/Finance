// react-native-gesture-handler llega como dependencia opcional del menú lateral
// de Expo Router (que no usamos). Su código nativo genera rutas de más de 260
// caracteres en Windows y rompe la compilación, así que no lo enlazamos.
module.exports = {
  dependencies: {
    'react-native-gesture-handler': { platforms: { android: null, ios: null } },
  },
};
