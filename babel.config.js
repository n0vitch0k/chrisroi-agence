module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4.5+ : plugin worklets pour les directives 'worklet'
    // Doit rester le DERNIER plugin de la liste.
    plugins: ['react-native-worklets/plugin'],
  };
};
