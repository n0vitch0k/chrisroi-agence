module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 (SDK 54) : le plugin est fourni par react-native-worklets.
    // Doit rester le DERNIER plugin de la liste.
    plugins: ['react-native-worklets/plugin'],
  };
};
